import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseOAuthCallback,
  validateSignupInput,
  classifySignupResult,
  normalizeIndianPhoneNumber,
  validateOtpInput,
  classifyOtpRequestResult,
  classifyOtpVerifyResult,
} from '../src/lib/authUtils.js';
import {
  signInWithGoogle,
  signUpWithEmail,
  onAuthStateChange,
  setSession,
  requestPhoneOtp,
  verifyPhoneOtp,
} from '../src/lib/supabaseClient.js';

test('parseOAuthCallback returns false/null on normal page visits', () => {
  const result = parseOAuthCallback('', '');
  assert.deepEqual(result, {
    hasCode: false,
    hasToken: false,
    isOAuthReturn: false,
    error: null,
  });
});

test('parseOAuthCallback detects PKCE code in search parameters', () => {
  const result = parseOAuthCallback('?code=test-auth-code-12345', '');
  assert.strictEqual(result.hasCode, true);
  assert.strictEqual(result.hasToken, false);
  assert.strictEqual(result.isOAuthReturn, true);
  assert.strictEqual(result.error, null);
});

test('parseOAuthCallback detects implicit access_token in hash fragment', () => {
  const result = parseOAuthCallback(
    '',
    '#access_token=mock-token&refresh_token=mock-refresh&token_type=bearer'
  );
  assert.strictEqual(result.hasCode, false);
  assert.strictEqual(result.hasToken, true);
  assert.strictEqual(result.isOAuthReturn, true);
  assert.strictEqual(result.error, null);
});

test('parseOAuthCallback extracts and decodes error description from search parameters', () => {
  const result = parseOAuthCallback(
    '?error=access_denied&error_description=Signups+not+allowed+for+this+instance',
    ''
  );
  assert.strictEqual(result.isOAuthReturn, true);
  assert.strictEqual(result.error, 'Signups not allowed for this instance');
});

test('parseOAuthCallback extracts error code and description from hash fragment', () => {
  const result = parseOAuthCallback(
    '',
    '#error=access_denied&error_code=403&error_description=Access+denied+by+Google'
  );
  assert.strictEqual(result.isOAuthReturn, true);
  assert.strictEqual(result.error, '[403] Access denied by Google');
});

test('parseOAuthCallback handles encoded special characters in error messages', () => {
  const result = parseOAuthCallback(
    '?error=invalid_request&error_description=User%27s+email+is+not+verified%21',
    ''
  );
  assert.strictEqual(result.error, "User's email is not verified!");
});

test('signInWithGoogle falls back safely when Supabase client is not configured', async () => {
  const res = await signInWithGoogle();
  assert.ok(res !== undefined);
});

test('signUpWithEmail falls back safely when Supabase client is not configured', async () => {
  const res = await signUpWithEmail('test@example.com', 'Password123!');
  assert.ok(res !== undefined);
});

test('onAuthStateChange returns an unsubscribe function safely', () => {
  const unsubscribe = onAuthStateChange(() => {});
  assert.strictEqual(typeof unsubscribe, 'function');
  assert.doesNotThrow(() => unsubscribe());
});

test('setSession falls back safely when session data is null or empty', async () => {
  const resNull = await setSession(null);
  assert.ok(resNull !== undefined);
  const resEmpty = await setSession({});
  assert.ok(resEmpty !== undefined);
});

// ── Signup Validation Tests ──────────────────────────────────────────────────

test('validateSignupInput rejects empty inputs', () => {
  const { isValid, errors } = validateSignupInput({});
  assert.strictEqual(isValid, false);
  assert.strictEqual(errors.email, 'Email is required.');
  assert.strictEqual(errors.password, 'Password is required.');
  assert.strictEqual(errors.confirm, 'Please confirm your password.');
});

test('validateSignupInput rejects invalid email format', () => {
  const { isValid, errors } = validateSignupInput({
    email: 'invalid-email-address',
    password: 'Password123!',
    confirm: 'Password123!',
  });
  assert.strictEqual(isValid, false);
  assert.strictEqual(errors.email, 'Enter a valid email address.');
});

test('validateSignupInput enforces minimum password length of 8 characters', () => {
  const { isValid, errors } = validateSignupInput({
    email: 'valid@example.com',
    password: 'short',
    confirm: 'short',
  });
  assert.strictEqual(isValid, false);
  assert.strictEqual(errors.password, 'Password must be at least 8 characters.');
});

test('validateSignupInput rejects mismatching confirm password', () => {
  const { isValid, errors } = validateSignupInput({
    email: 'valid@example.com',
    password: 'Password123!',
    confirm: 'DifferentPassword!',
  });
  assert.strictEqual(isValid, false);
  assert.strictEqual(errors.confirm, 'Passwords do not match.');
});

test('validateSignupInput accepts valid email and matching passwords', () => {
  const { isValid, errors } = validateSignupInput({
    email: '  farmer@example.com  ',
    password: 'SecurePassword123!',
    confirm: 'SecurePassword123!',
  });
  assert.strictEqual(isValid, true);
  assert.deepEqual(errors, {});
});

// ── Supabase Signup Response Classification Tests ────────────────────────────

test('classifySignupResult detects duplicate email when identities array is empty', () => {
  const outcome = classifySignupResult({
    data: {
      user: {
        id: '2e51b293-a1c4-43db-a96f-df3c33547d78',
        email: 'existing@example.com',
        identities: [],
      },
      session: null,
    },
    error: null,
  });

  assert.strictEqual(outcome.status, 'duplicate_email');
  assert.ok(outcome.message.includes('already exists'));
});

test('classifySignupResult detects duplicate email from explicit error message', () => {
  const outcome = classifySignupResult({
    data: null,
    error: {
      message: 'User already registered',
      code: 'user_already_exists',
    },
  });

  assert.strictEqual(outcome.status, 'duplicate_email');
  assert.ok(outcome.message.includes('already exists'));
});

test('classifySignupResult handles immediate session when confirmation is disabled', () => {
  const mockSession = { access_token: 'tok-123', refresh_token: 'ref-123' };
  const mockUser = { id: 'u-123', email: 'farmer@example.com' };

  const outcome = classifySignupResult({
    data: {
      user: mockUser,
      session: mockSession,
    },
    error: null,
  });

  assert.strictEqual(outcome.status, 'success_session');
  assert.deepEqual(outcome.session, mockSession);
  assert.deepEqual(outcome.user, mockUser);
});

test('classifySignupResult handles confirmation required when identities is populated', () => {
  const outcome = classifySignupResult({
    data: {
      user: {
        id: 'u-new',
        email: 'newuser@example.com',
        identities: [{ id: 'id-1', provider: 'email' }],
      },
      session: null,
    },
    error: null,
  });

  assert.strictEqual(outcome.status, 'confirmation_required');
  assert.ok(outcome.message.includes('newuser@example.com'));
  assert.ok(outcome.message.includes('confirmation link'));
});

test('classifySignupResult handles general Supabase auth errors', () => {
  const outcome = classifySignupResult({
    data: null,
    error: {
      message: 'Password should contain at least one character of each: abc, ABC, 123',
    },
  });

  assert.strictEqual(outcome.status, 'error');
  assert.strictEqual(
    outcome.message,
    'Password should contain at least one character of each: abc, ABC, 123'
  );
});

test('classifySignupResult handles rate limit errors from Supabase', () => {
  const outcome = classifySignupResult({
    data: null,
    error: {
      name: 'AuthApiError',
      message: 'email rate limit exceeded',
      status: 429,
      code: 'over_email_send_rate_limit',
    },
  });

  assert.strictEqual(outcome.status, 'rate_limited');
  assert.ok(outcome.message.includes('Verification email limit reached'));
});

test('classifySignupResult handles invalid email address error from Supabase', () => {
  const outcome = classifySignupResult({
    data: null,
    error: {
      name: 'AuthApiError',
      message: 'Email address "bad@example.com" is invalid',
      status: 400,
      code: 'email_address_invalid',
    },
  });

  assert.strictEqual(outcome.status, 'error');
  assert.ok(outcome.message.includes('deliverable email address'));
});

test('classifySignupResult detects duplicate email with email_exists code', () => {
  const outcome = classifySignupResult({
    data: null,
    error: {
      message: 'A user with this email address already exists',
      code: 'email_exists',
    },
  });

  assert.strictEqual(outcome.status, 'duplicate_email');
  assert.ok(outcome.message.includes('already exists'));
});

test('classifySignupResult handles network or fetch failure error', () => {
  const outcome = classifySignupResult({
    data: null,
    error: {
      message: 'Failed to fetch',
      name: 'AuthRetryableFetchError',
    },
  });

  assert.strictEqual(outcome.status, 'error');
  assert.strictEqual(outcome.message, 'Failed to fetch');
});

test('signOut clears guest mode and auth intent from sessionStorage', async () => {
  const store = new Map();
  store.set('quantum_agri_guest_mode', 'true');
  store.set('quantum_agri_auth_intent', 'signup');

  const originalWindow = globalThis.window;
  globalThis.window = {
    sessionStorage: {
      getItem: (k) => store.get(k) || null,
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
  };
  globalThis.sessionStorage = globalThis.window.sessionStorage;

  try {
    const { signOut } = await import('../src/lib/supabaseClient.js');
    await signOut();
    assert.strictEqual(store.has('quantum_agri_guest_mode'), false);
    assert.strictEqual(store.has('quantum_agri_auth_intent'), false);
  } finally {
    if (originalWindow === undefined) {
      delete globalThis.window;
      delete globalThis.sessionStorage;
    } else {
      globalThis.window = originalWindow;
    }
  }
});

test('classifySignupResult safely handles null / undefined input', () => {
  const outcome = classifySignupResult(null);
  assert.strictEqual(outcome.status, 'error');
  assert.ok(outcome.message !== undefined);
});

// ==========================================
// Phone Number Validation & Formatting Tests
// ==========================================

test('normalizeIndianPhoneNumber formats 10-digit number to E.164 (+91)', () => {
  const result = normalizeIndianPhoneNumber('9876543210');
  assert.strictEqual(result.isValid, true);
  assert.strictEqual(result.normalized, '+919876543210');
  assert.strictEqual(result.error, null);
});

test('normalizeIndianPhoneNumber accepts numbers with +91, 91, and 0 prefixes and whitespace/hyphens', () => {
  const withPlus91 = normalizeIndianPhoneNumber('+91 98765-43210');
  assert.strictEqual(withPlus91.isValid, true);
  assert.strictEqual(withPlus91.normalized, '+919876543210');

  const with91 = normalizeIndianPhoneNumber('919876543210');
  assert.strictEqual(with91.isValid, true);
  assert.strictEqual(with91.normalized, '+919876543210');

  const withZero = normalizeIndianPhoneNumber('09876543210');
  assert.strictEqual(withZero.isValid, true);
  assert.strictEqual(withZero.normalized, '+919876543210');
});

test('normalizeIndianPhoneNumber rejects invalid numbers', () => {
  // Empty
  assert.strictEqual(normalizeIndianPhoneNumber('').isValid, false);
  assert.strictEqual(normalizeIndianPhoneNumber(null).isValid, false);

  // Less than 10 digits
  const shortNum = normalizeIndianPhoneNumber('987654321');
  assert.strictEqual(shortNum.isValid, false);

  // Does not start with 6, 7, 8, or 9
  const invalidStart = normalizeIndianPhoneNumber('4876543210');
  assert.strictEqual(invalidStart.isValid, false);
  assert.ok(invalidStart.error.includes('begin with 6, 7, 8, or 9'));
});

// ==========================================
// OTP Input Validation Tests
// ==========================================

test('validateOtpInput validates 6-digit numeric tokens', () => {
  assert.strictEqual(validateOtpInput('123456').isValid, true);
  assert.strictEqual(validateOtpInput('12345').isValid, false);
  assert.strictEqual(validateOtpInput('1234567').isValid, false);
  assert.strictEqual(validateOtpInput('abcdef').isValid, false);
  assert.strictEqual(validateOtpInput('').isValid, false);
});

// ==========================================
// Phone OTP Request Classification Tests
// ==========================================

test('classifyOtpRequestResult recognizes success', () => {
  const res = classifyOtpRequestResult({ data: {}, error: null });
  assert.strictEqual(res.status, 'otp_sent');
  assert.ok(res.message.includes('successfully'));
});

test('classifyOtpRequestResult detects unconfigured SMS provider', () => {
  const res = classifyOtpRequestResult({
    data: null,
    error: {
      message: 'Unsupported phone provider: Twilio is not enabled',
      code: 'phone_provider_disabled',
    },
  });
  assert.strictEqual(res.status, 'provider_disabled');
  assert.ok(res.message.includes('SMS service is not enabled'));
  assert.ok(res.message.includes('Twilio'));
});

test('classifyOtpRequestResult detects rate limiting and invalid phone errors', () => {
  const rateLimit = classifyOtpRequestResult({
    data: null,
    error: {
      message: 'over_sms_send_rate_limit',
      code: 'over_sms_send_rate_limit',
      status: 429,
    },
  });
  assert.strictEqual(rateLimit.status, 'rate_limited');

  const invalidPhone = classifyOtpRequestResult({
    data: null,
    error: {
      message: 'Invalid phone number format',
      code: 'phone_number_invalid',
    },
  });
  assert.strictEqual(invalidPhone.status, 'invalid_phone');
});

// ==========================================
// Phone OTP Verification Classification Tests
// ==========================================

test('classifyOtpVerifyResult recognizes valid session upon verification', () => {
  const mockSession = { access_token: 'valid_jwt_token', refresh_token: 'refresh_tok' };
  const mockUser = { id: 'phone-user-1', phone: '+919876543210' };

  const res = classifyOtpVerifyResult({
    data: { session: mockSession, user: mockUser },
    error: null,
  });

  assert.strictEqual(res.status, 'success_session');
  assert.deepEqual(res.session, mockSession);
  assert.deepEqual(res.user, mockUser);
});

test('classifyOtpVerifyResult handles invalid or expired OTP code', () => {
  const res = classifyOtpVerifyResult({
    data: null,
    error: {
      message: 'Token has expired or is invalid',
      code: 'otp_expired',
    },
  });

  assert.strictEqual(res.status, 'invalid_otp');
  assert.ok(res.message.includes('expired OTP code'));
});

test('classifyOtpVerifyResult handles rate limiting on verify attempts', () => {
  const res = classifyOtpVerifyResult({
    data: null,
    error: {
      message: 'Too many requests',
      status: 429,
    },
  });

  assert.strictEqual(res.status, 'rate_limited');
  assert.ok(res.message.includes('Too many verification attempts'));
});

// ==========================================
// Client Wrapper Safety Fallbacks
// ==========================================

test('requestPhoneOtp and verifyPhoneOtp fall back safely when Supabase client is unconfigured', async () => {
  const reqRes = await requestPhoneOtp('+919876543210');
  assert.ok(reqRes.error);
  assert.ok(reqRes.error.message.includes('Supabase is not configured'));

  const verifyRes = await verifyPhoneOtp('+919876543210', '123456');
  assert.ok(verifyRes.error);
  assert.ok(verifyRes.error.message.includes('Supabase is not configured'));
});



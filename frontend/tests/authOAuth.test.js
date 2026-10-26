import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseOAuthCallback,
  validateSignupInput,
  classifySignupResult,
} from '../src/lib/authUtils.js';
import {
  signInWithGoogle,
  signUpWithEmail,
  onAuthStateChange,
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

test('classifySignupResult safely handles null / undefined input', () => {
  const outcome = classifySignupResult(null);
  assert.strictEqual(outcome.status, 'error');
  assert.ok(outcome.message !== undefined);
});

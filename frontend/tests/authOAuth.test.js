import test from 'node:test';
import assert from 'node:assert/strict';

import { parseOAuthCallback } from '../src/lib/authUtils.js';
import { signInWithGoogle, onAuthStateChange } from '../src/lib/supabaseClient.js';

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
  // Either calls supabase or returns not configured error safely without throwing
  assert.ok(res !== undefined);
});

test('onAuthStateChange returns an unsubscribe function safely', () => {
  const unsubscribe = onAuthStateChange(() => {});
  assert.strictEqual(typeof unsubscribe, 'function');
  // Calling unsubscribe should execute cleanly without throwing
  assert.doesNotThrow(() => unsubscribe());
});

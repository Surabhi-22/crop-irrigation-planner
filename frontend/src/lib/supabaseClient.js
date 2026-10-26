/**
 * CropWise — Supabase client module.
 *
 * Reads credentials from Vite env variables at runtime.
 * Never hardcodes secrets.
 *
 * Required .env keys (in frontend root):
 *   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
 *   VITE_SUPABASE_PUBLISHABLE_KEY=<anon/publishable key>
 *   (alias) VITE_SUPABASE_ANON_KEY=<anon key>
 *
 * Google OAuth redirect:
 *   VITE_APP_URL=http://localhost:5173   (defaults to window.location.origin)
 */

import { createClient } from "@supabase/supabase-js";

const env =
  typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};

const rawUrl = env.VITE_SUPABASE_URL?.trim() || "";
let supabaseUrl = rawUrl;
if (supabaseUrl && !supabaseUrl.startsWith("http://") && !supabaseUrl.startsWith("https://")) {
  supabaseUrl = supabaseUrl.includes(".")
    ? `https://${supabaseUrl}`
    : `https://${supabaseUrl}.supabase.co`;
}

// Support both the legacy ANON_KEY name and the newer PUBLISHABLE_KEY name
const supabaseKey =
  (env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    env.VITE_SUPABASE_ANON_KEY?.trim()) ?? "";

/**
 * True when both credentials are present and look plausible.
 * Does NOT make a network call — just a format check.
 */
export const isSupabaseConfigured =
  supabaseUrl.startsWith("https://") && supabaseKey.length > 10;

/**
 * The Supabase client instance, or null when credentials are missing.
 * All auth helpers guard against null and surface a clear setup error.
 */
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// ─── Auth helpers ────────────────────────────────────────────────────────────

const NOT_CONFIGURED_ERROR = {
  error: {
    message:
      "Supabase is not configured. Add VITE_SUPABASE_URL and " +
      "VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY) " +
      "to your frontend/.env file and restart the dev server.",
  },
  data: null,
};

/**
 * Sign in with email + password.
 */
export async function signInWithEmail(email, password) {
  if (!supabase) return NOT_CONFIGURED_ERROR;
  return supabase.auth.signInWithPassword({ email, password });
}

/**
 * Create a new account with email + password.
 */
export async function signUpWithEmail(email, password) {
  if (!supabase) return NOT_CONFIGURED_ERROR;
  return supabase.auth.signUp({ email, password });
}

/**
 * Initiate Google OAuth flow.
 * The user is redirected back to the app after authentication.
 */
export async function signInWithGoogle(options = {}) {
  if (!supabase) return NOT_CONFIGURED_ERROR;

  const redirectTo =
    options.redirectTo ||
    env.VITE_APP_URL?.trim() ||
    (typeof window !== "undefined" ? window.location.origin : "");

  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      ...options,
    },
  });
}

/**
 * Send a password-reset email.
 */
export async function sendPasswordReset(email) {
  if (!supabase) return NOT_CONFIGURED_ERROR;

  const origin =
    env.VITE_APP_URL?.trim() ||
    (typeof window !== "undefined" ? window.location.origin : "");
  const redirectTo = origin ? `${origin}?auth=reset` : undefined;

  return supabase.auth.resetPasswordForEmail(email, { redirectTo });
}

/**
 * Sign out the current user.
 */
export async function signOut() {
  if (!supabase) return NOT_CONFIGURED_ERROR;
  return supabase.auth.signOut();
}

/**
 * Subscribe to auth state changes.
 * Returns the unsubscribe function.
 */
export function onAuthStateChange(callback) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
  return () => data?.subscription?.unsubscribe?.();
}

/**
 * Get the current session synchronously (may be null on cold load).
 */
export async function getSession() {
  if (!supabase) return { data: { session: null }, error: null };
  return supabase.auth.getSession();
}

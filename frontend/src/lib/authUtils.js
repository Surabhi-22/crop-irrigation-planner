/**
 * Pure utility functions for auth validation, OAuth redirect handling, and signup response classification.
 */

/**
 * Parses URL search and hash fragments for OAuth return data or errors.
 *
 * @param {string} search - window.location.search or query string
 * @param {string} hash - window.location.hash or hash fragment
 * @returns {{ hasCode: boolean, hasToken: boolean, isOAuthReturn: boolean, error: string | null }}
 */
export function parseOAuthCallback(search = "", hash = "") {
  const searchParams = new URLSearchParams(search);
  const cleanHash = hash.startsWith("#") ? hash.substring(1) : hash;
  const hashParams = new URLSearchParams(cleanHash);

  const code = searchParams.get("code") || hashParams.get("code");
  const accessToken = searchParams.get("access_token") || hashParams.get("access_token");

  const rawError =
    searchParams.get("error_description") ||
    searchParams.get("error") ||
    hashParams.get("error_description") ||
    hashParams.get("error");

  const errorCode = searchParams.get("error_code") || hashParams.get("error_code");

  let error = null;
  if (rawError) {
    try {
      error = decodeURIComponent(rawError.replace(/\+/g, " "));
    } catch {
      error = rawError;
    }
    if (errorCode && !error.includes(errorCode)) {
      error = `[${errorCode}] ${error}`;
    }
  }

  return {
    hasCode: Boolean(code),
    hasToken: Boolean(accessToken),
    isOAuthReturn: Boolean(code || accessToken || rawError),
    error,
  };
}

/**
 * Validates signup form inputs.
 *
 * @param {{ email?: string, password?: string, confirm?: string }} fields
 * @returns {{ isValid: boolean, errors: { email?: string, password?: string, confirm?: string } }}
 */
export function validateSignupInput({ email = "", password = "", confirm = "" }) {
  const errors = {};

  const cleanEmail = email.trim();
  if (!cleanEmail) {
    errors.email = "Email is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    errors.email = "Enter a valid email address.";
  }

  if (!password) {
    errors.password = "Password is required.";
  } else if (password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
  }

  if (!confirm) {
    errors.confirm = "Please confirm your password.";
  } else if (password && confirm && password !== confirm) {
    errors.confirm = "Passwords do not match.";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Classifies the outcome of a Supabase auth.signUp() response.
 *
 * Supabase returns { data: { user, session }, error }.
 * - When an email already exists (under default email confirmation settings):
 *   Supabase returns error: null, session: null, but user.identities is an empty array [].
 * - When a new account is registered and email confirmation is required:
 *   Supabase returns error: null, session: null, and user.identities has >= 1 identity.
 * - When email confirmation is disabled:
 *   Supabase returns error: null and session is populated.
 * - When an error occurs:
 *   Supabase returns an error object (or user already registered error).
 *
 * @param {{ data?: { user?: object, session?: object } | null, error?: { message?: string, code?: string } | null }} response
 * @returns {{ status: 'success_session' | 'confirmation_required' | 'duplicate_email' | 'error', message?: string, user?: object, session?: object }}
 */
export function classifySignupResult(response) {
  if (!response) {
    return {
      status: "error",
      message: "Unable to process signup request. Please try again.",
    };
  }

  const { data, error } = response;

  if (error) {
    const isDuplicate =
      error.message?.toLowerCase().includes("already registered") ||
      error.code === "user_already_exists";

    if (isDuplicate) {
      return {
        status: "duplicate_email",
        message: "An account with this email already exists. Please sign in instead.",
      };
    }

    const isRateLimited =
      error.code === "over_email_send_rate_limit" ||
      error.status === 429 ||
      error.message?.toLowerCase().includes("rate limit");

    if (isRateLimited) {
      return {
        status: "rate_limited",
        message:
          "Verification email limit reached for this hour. Please wait a short while before trying again, or continue with Google sign-in.",
      };
    }

    if (error.code === "email_address_invalid") {
      return {
        status: "error",
        message:
          "Please provide a standard, deliverable email address (e.g. Gmail, Outlook, or corporate domain).",
      };
    }

    return {
      status: "error",
      message: error.message || "Failed to create account. Please check your details.",
    };
  }

  // Check for duplicate account where identities is empty (Supabase email enumeration protection)
  if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return {
      status: "duplicate_email",
      message: "An account with this email already exists. Please sign in instead.",
    };
  }

  // Active session returned (confirmation disabled in Supabase)
  if (data?.session) {
    return {
      status: "success_session",
      session: data.session,
      user: data.user,
    };
  }

  // New account created with email verification link sent
  if (data?.user) {
    const targetEmail = data.user.email || "your email address";
    return {
      status: "confirmation_required",
      user: data.user,
      message: `Account created! We've sent a confirmation link to ${targetEmail}. Please check your email and click the confirmation link before signing in.`,
    };
  }

  return {
    status: "error",
    message: "Signup could not be completed. Please try again or sign in.",
  };
}

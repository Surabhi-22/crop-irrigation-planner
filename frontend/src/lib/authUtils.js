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
      error.message?.toLowerCase().includes("already exists") ||
      error.message?.toLowerCase().includes("already been registered") ||
      error.code === "user_already_exists" ||
      error.code === "email_exists";

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

/**
 * Normalizes and validates an Indian mobile number to E.164 format (+91XXXXXXXXXX).
 * Accepts formats:
 *   - 10 digits: "9876543210" -> "+919876543210"
 *   - With 0 prefix: "09876543210" -> "+919876543210"
 *   - With 91 prefix: "919876543210" -> "+919876543210"
 *   - With +91 prefix: "+919876543210" -> "+919876543210"
 *   - With whitespace or hyphens: "+91 98765-43210" -> "+919876543210"
 *
 * @param {string} rawPhone
 * @returns {{ isValid: boolean, normalized: string, error: string | null }}
 */
export function normalizeIndianPhoneNumber(rawPhone = "") {
  if (!rawPhone || typeof rawPhone !== "string") {
    return {
      isValid: false,
      normalized: "",
      error: "Phone number is required.",
    };
  }

  // Remove whitespace, hyphens, parentheses, dots
  let cleaned = rawPhone.trim().replace(/[\s\-().]/g, "");

  if (!cleaned) {
    return {
      isValid: false,
      normalized: "",
      error: "Phone number is required.",
    };
  }

  // If starts with '+', keep '+' and strip non-digits after it
  if (cleaned.startsWith("+")) {
    cleaned = "+" + cleaned.slice(1).replace(/\D/g, "");
  } else {
    cleaned = cleaned.replace(/\D/g, "");
  }

  let nationalDigits;

  if (cleaned.startsWith("+91")) {
    nationalDigits = cleaned.slice(3);
  } else if (cleaned.startsWith("91") && cleaned.length === 12) {
    nationalDigits = cleaned.slice(2);
  } else if (cleaned.startsWith("0") && cleaned.length === 11) {
    nationalDigits = cleaned.slice(1);
  } else if (/^\d{10}$/.test(cleaned)) {
    nationalDigits = cleaned;
  } else {
    return {
      isValid: false,
      normalized: "",
      error: "Enter a valid 10-digit Indian mobile number.",
    };
  }

  // Validate length is exactly 10 digits
  if (nationalDigits.length !== 10) {
    return {
      isValid: false,
      normalized: "",
      error: "Indian mobile number must be exactly 10 digits.",
    };
  }

  // Indian mobile numbers start with 6, 7, 8, or 9
  if (!/^[6-9]/.test(nationalDigits)) {
    return {
      isValid: false,
      normalized: "",
      error: "Indian mobile number must begin with 6, 7, 8, or 9.",
    };
  }

  return {
    isValid: true,
    normalized: `+91${nationalDigits}`,
    error: null,
  };
}

/**
 * Validates a 6-digit OTP code string.
 *
 * @param {string} token
 * @returns {{ isValid: boolean, error: string | null }}
 */
export function validateOtpInput(token = "") {
  const clean = typeof token === "string" ? token.trim() : "";
  if (!clean) {
    return { isValid: false, error: "Please enter the 6-digit OTP." };
  }
  if (!/^\d{6}$/.test(clean)) {
    return { isValid: false, error: "OTP must be exactly 6 digits." };
  }
  return { isValid: true, error: null };
}

/**
 * Classifies the response from supabase.auth.signInWithOtp({ phone }).
 *
 * @param {{ data?: object | null, error?: { message?: string, code?: string, status?: number } | null }} response
 * @returns {{ status: 'otp_sent' | 'provider_disabled' | 'rate_limited' | 'invalid_phone' | 'error', message: string }}
 */
export function classifyOtpRequestResult(response) {
  if (!response) {
    return {
      status: "error",
      message: "Unable to process OTP request. Please try again.",
    };
  }

  const { error } = response;
  if (error) {
    const msg = (error.message || "").toLowerCase();
    const code = error.code || "";

    if (
      code === "phone_provider_disabled" ||
      msg.includes("unsupported phone provider") ||
      msg.includes("phone provider is disabled")
    ) {
      return {
        status: "provider_disabled",
        message:
          "SMS service is not enabled on this Supabase project. A phone provider (such as Twilio) must be configured in the Supabase Dashboard under Authentication > Providers > Phone.",
      };
    }

    if (
      code === "over_sms_send_rate_limit" ||
      error.status === 429 ||
      msg.includes("rate limit")
    ) {
      return {
        status: "rate_limited",
        message: "SMS request limit reached. Please wait a short while before trying again.",
      };
    }

    if (
      code === "phone_number_invalid" ||
      msg.includes("invalid phone") ||
      msg.includes("bad phone number")
    ) {
      return {
        status: "invalid_phone",
        message: "The phone number is invalid. Please check and try again.",
      };
    }

    return {
      status: "error",
      message: error.message || "Failed to send OTP. Please check your network and try again.",
    };
  }

  return {
    status: "otp_sent",
    message: "OTP sent successfully! Please check your mobile phone.",
  };
}

/**
 * Classifies the response from supabase.auth.verifyOtp({ phone, token, type: 'sms' }).
 *
 * @param {{ data?: { session?: object, user?: object } | null, error?: { message?: string, code?: string, status?: number } | null }} response
 * @returns {{ status: 'success_session' | 'invalid_otp' | 'rate_limited' | 'error', message?: string, session?: object, user?: object }}
 */
export function classifyOtpVerifyResult(response) {
  if (!response) {
    return {
      status: "error",
      message: "Unable to verify OTP. Please try again.",
    };
  }

  const { data, error } = response;
  if (error) {
    const msg = (error.message || "").toLowerCase();
    const code = error.code || "";

    if (
      code === "otp_expired" ||
      msg.includes("expired") ||
      msg.includes("invalid") ||
      msg.includes("token has expired")
    ) {
      return {
        status: "invalid_otp",
        message: "Incorrect or expired OTP code. Please enter the code received or request a new one.",
      };
    }

    if (error.status === 429 || msg.includes("rate limit") || msg.includes("too many requests")) {
      return {
        status: "rate_limited",
        message: "Too many verification attempts. Please wait a moment before trying again.",
      };
    }

    return {
      status: "error",
      message: error.message || "Verification failed. Please try again.",
    };
  }

  if (data?.session) {
    return {
      status: "success_session",
      session: data.session,
      user: data.user,
    };
  }

  return {
    status: "error",
    message: "Authentication could not be established. Please try again.",
  };
}

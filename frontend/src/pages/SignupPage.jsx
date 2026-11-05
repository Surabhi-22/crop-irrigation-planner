/**
 * Quantum Agri — Sign Up Page
 *
 * New account creation: email + password + confirm password.
 * Google OAuth sign-up flows through the same signInWithGoogle helper.
 * All auth delegated to Supabase — no mock credentials accepted.
 */

import { useState, useEffect } from "react";
import {
  signUpWithEmail,
  signInWithGoogle,
  setSession,
  requestPhoneOtp,
  verifyPhoneOtp,
} from "../lib/supabaseClient";
import {
  validateSignupInput,
  classifySignupResult,
  normalizeIndianPhoneNumber,
  validateOtpInput,
  classifyOtpRequestResult,
  classifyOtpVerifyResult,
} from "../lib/authUtils";

export default function SignupPage({
  onNavigateToLogin,
  onAuthSuccess,
  oauthError,
}) {
  // Method selection: "email" | "phone"
  const [signupMethod, setSignupMethod] = useState("email");

  // Email form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  // Phone form state: "enter_phone" | "verify_otp"
  const [phoneStep, setPhoneStep] = useState("enter_phone");
  const [phone, setPhone] = useState("");
  const [normalizedPhone, setNormalizedPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [phoneSuccess, setPhoneSuccess] = useState("");
  const [otpCooldown, setOtpCooldown] = useState(0);

  const displayError = error || oauthError;

  // OTP resend cooldown timer
  useEffect(() => {
    let timer;
    if (phoneStep === "verify_otp" && otpCooldown > 0) {
      timer = setInterval(() => {
        setOtpCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [phoneStep, otpCooldown]);

  // Password strength indicator
  function getStrength(pw) {
    if (!pw) return 0;
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return score; // 0–4
  }

  const strength = getStrength(password);
  const strengthLabels = ["", "Weak", "Fair", "Good", "Strong"];
  const strengthClasses = ["", "auth-strength--weak", "auth-strength--fair", "auth-strength--good", "auth-strength--strong"];

  // ── Email submit handler ──────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    if (loading || googleLoading) return; // Prevent duplicate submission
    setError("");
    setSuccess("");

    const validation = validateSignupInput({ email, password, confirm });
    setFieldErrors(validation.errors);
    if (!validation.isValid) return;

    setLoading(true);
    try {
      const response = await signUpWithEmail(email.trim(), password);
      const outcome = classifySignupResult(response);

      if (outcome.status === "duplicate_email") {
        setError(outcome.message);
      } else if (outcome.status === "rate_limited") {
        setError(outcome.message);
      } else if (outcome.status === "error") {
        setError(outcome.message);
      } else if (outcome.status === "success_session") {
        // Immediately signed in (email confirmation disabled in Supabase)
        if (outcome.session) {
          try {
            await setSession(outcome.session);
          } catch {
            // ignore
          }
        }
        onAuthSuccess?.(outcome.session);
      } else if (outcome.status === "confirmation_required") {
        // Genuine new account created with confirmation email pending
        setSuccess(outcome.message);
      }
    } catch (err) {
      setError(err?.message || "An unexpected error occurred during signup.");
    } finally {
      setLoading(false);
    }
  }

  // ── Google OAuth handler ──────────────────────────────────────────────
  async function handleGoogle() {
    if (googleLoading || loading) return;
    setError("");
    setGoogleLoading(true);
    try {
      try {
        sessionStorage.setItem("quantum_agri_auth_intent", "signup");
      } catch {
        // ignore
      }
      const { error: authError } = await signInWithGoogle();
      if (authError) setError(authError.message);
    } finally {
      setGoogleLoading(false);
    }
  }

  // ── Phone OTP request handler ─────────────────────────────────────────
  async function handlePhoneSubmit(e) {
    e.preventDefault();
    if (phoneLoading) return; // Prevent duplicate request
    setPhoneError("");
    setPhoneSuccess("");

    const norm = normalizeIndianPhoneNumber(phone);
    if (!norm.isValid) {
      setPhoneError(norm.error);
      return;
    }

    setPhoneLoading(true);
    try {
      const response = await requestPhoneOtp(norm.normalized);
      const outcome = classifyOtpRequestResult(response);

      if (outcome.status === "otp_sent") {
        setNormalizedPhone(norm.normalized);
        setPhoneStep("verify_otp");
        setOtpCooldown(60);
        setPhoneSuccess(`6-digit verification code sent to ${norm.normalized}`);
      } else {
        setPhoneError(outcome.message);
      }
    } catch (err) {
      setPhoneError(err?.message || "Failed to send OTP. Please check your connection and try again.");
    } finally {
      setPhoneLoading(false);
    }
  }

  // ── Resend OTP handler ────────────────────────────────────────────────
  async function handleResendOtp() {
    if (phoneLoading || otpCooldown > 0) return;
    setPhoneError("");
    setPhoneSuccess("");

    setPhoneLoading(true);
    try {
      const response = await requestPhoneOtp(normalizedPhone);
      const outcome = classifyOtpRequestResult(response);

      if (outcome.status === "otp_sent") {
        setOtpCooldown(60);
        setPhoneSuccess(`A fresh OTP code has been sent to ${normalizedPhone}.`);
      } else {
        setPhoneError(outcome.message);
      }
    } catch (err) {
      setPhoneError(err?.message || "Failed to resend OTP. Please try again.");
    } finally {
      setPhoneLoading(false);
    }
  }

  // ── Verify OTP handler ────────────────────────────────────────────────
  async function handleVerifyOtp(e) {
    e.preventDefault();
    if (otpLoading) return; // Prevent duplicate verification
    setPhoneError("");
    setPhoneSuccess("");

    const validation = validateOtpInput(otp);
    if (!validation.isValid) {
      setPhoneError(validation.error);
      return;
    }

    setOtpLoading(true);
    try {
      const response = await verifyPhoneOtp(normalizedPhone, otp);
      const outcome = classifyOtpVerifyResult(response);

      if (outcome.status === "success_session") {
        if (outcome.session) {
          try {
            await setSession(outcome.session);
          } catch {
            // ignore
          }
        }
        onAuthSuccess?.(outcome.session);
      } else {
        setPhoneError(outcome.message);
      }
    } catch (err) {
      setPhoneError(err?.message || "Verification failed. Please check the OTP code and try again.");
    } finally {
      setOtpLoading(false);
    }
  }

  return (
    <div className="auth-layout">
      {/* ── Left branding panel ─────────────────────── */}
      <div className="auth-brand-panel">
        <div className="auth-brand-content">
          <div className="auth-brand-icon">
            <span className="material-symbols-outlined">eco</span>
          </div>
          <h1 className="auth-brand-name">Quantum Agri</h1>
          <p className="auth-brand-sub">AGRICULTURAL INTELLIGENCE</p>
          <div className="auth-brand-divider" />
          <p className="auth-brand-tagline">
            Smarter Farming. Better Harvests.
          </p>
          <div className="auth-brand-features">
            <div className="auth-feature">
              <span className="material-symbols-outlined">analytics</span>
              <span>ML-powered yield predictions</span>
            </div>
            <div className="auth-feature">
              <span className="material-symbols-outlined">water_drop</span>
              <span>Smart irrigation planning</span>
            </div>
            <div className="auth-feature">
              <span className="material-symbols-outlined">trending_up</span>
              <span>Real-time market insights</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right form panel ────────────────────────── */}
      <div className="auth-form-panel">
        <div className="auth-card">
          <div className="auth-card-header">
            <h2 className="auth-card-title">Create your account</h2>
            <p className="auth-card-subtitle">
              Start planning smarter, more profitable crops
            </p>
          </div>

          {displayError && (
            <div className="auth-error-banner" role="alert">
              <span className="material-symbols-outlined">error</span>
              <div style={{ flex: 1 }}>
                <span>{displayError}</span>
                {(displayError.toLowerCase().includes("already exists") ||
                  displayError.toLowerCase().includes("already registered") ||
                  displayError.toLowerCase().includes("already been registered")) && (
                  <button
                    id="duplicate-go-to-login-btn"
                    type="button"
                    className="auth-link"
                    style={{ display: "block", marginTop: "6px", fontWeight: 600 }}
                    onClick={onNavigateToLogin}
                  >
                    Go to Sign In &rarr;
                  </button>
                )}
                {displayError.toLowerCase().includes("rate limit") && (
                  <div style={{ marginTop: "8px" }}>
                    <button
                      id="rate-limit-google-btn"
                      type="button"
                      className="auth-link"
                      style={{ fontWeight: 600 }}
                      onClick={handleGoogle}
                    >
                      Sign In with Google Instead &rarr;
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {success ? (
            <div className="auth-card-success-view" style={{ textAlign: "center", padding: "12px 0" }}>
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "50%",
                  background: "var(--color-primary-light, #e8f5e9)",
                  color: "var(--color-primary, #059669)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "32px" }}>
                  mark_email_read
                </span>
              </div>
              <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 8px" }}>
                Check Your Email
              </h3>
              <p style={{ color: "var(--color-text-muted)", fontSize: "14px", lineHeight: "1.5", margin: "0 0 16px" }}>
                {success}
              </p>
              <div
                style={{
                  background: "var(--color-background-soft, #f8f9fa)",
                  borderRadius: "8px",
                  padding: "12px 16px",
                  textAlign: "left",
                  marginBottom: "20px",
                  fontSize: "13px",
                  border: "1px solid var(--color-border, #e5e7eb)",
                }}
              >
                <strong>Next steps to activate your account:</strong>
                <ol style={{ margin: "6px 0 0", paddingLeft: "20px", lineHeight: "1.5" }}>
                  <li>Open your inbox at <strong>{email.trim()}</strong>.</li>
                  <li>Click the confirmation link inside the email from Quantum Agri.</li>
                  <li>Check your spam or junk folder if the email does not arrive promptly.</li>
                  <li>Return here and sign in to access your farm workspace.</li>
                </ol>
              </div>

              {Boolean(
                import.meta.env?.DEV ||
                (typeof window !== "undefined" &&
                  (window.location.hostname === "localhost" ||
                    window.location.hostname === "127.0.0.1"))
              ) && (
                <div
                  id="dev-autoconfirm-tip"
                  style={{
                    background: "var(--color-primary-light, #f0fdf4)",
                    border: "1px solid var(--color-border, #bbf7d0)",
                    borderRadius: "8px",
                    padding: "12px 14px",
                    marginBottom: "16px",
                    textAlign: "left",
                    fontSize: "12px",
                    color: "var(--color-text, #166534)",
                    lineHeight: "1.5",
                  }}
                >
                  <strong style={{ display: "block", marginBottom: "4px" }}>
                    🛠️ Development / Testing Notice:
                  </strong>
                  Email confirmation is enabled on this Supabase project (<code>mailer_autoconfirm: false</code>).
                  To bypass this email verification step and reach the dashboard instantly during local testing, open your{" "}
                  <strong>Supabase Dashboard &rarr; Authentication &rarr; Providers &rarr; Email</strong> and turn off{" "}
                  <strong>&ldquo;Confirm email&rdquo;</strong>.
                </div>
              )}

              <button
                id="signup-to-login-btn"
                type="button"
                className="auth-btn-primary"
                onClick={onNavigateToLogin}
                style={{ width: "100%", justifyContent: "center" }}
              >
                <span className="material-symbols-outlined">login</span>
                Proceed to Sign In
              </button>
            </div>
          ) : (
            <>
              {/* Method Selection Tabs: Email vs Phone */}
              <div className="auth-method-tabs" role="tablist" aria-label="Signup method">
                <button
                  id="signup-tab-email"
                  type="button"
                  role="tab"
                  aria-selected={signupMethod === "email"}
                  className={`auth-method-tab ${signupMethod === "email" ? "auth-method-tab--active" : ""}`}
                  onClick={() => {
                    setSignupMethod("email");
                    setError("");
                    setPhoneError("");
                  }}
                >
                  <span className="material-symbols-outlined">mail</span>
                  <span>Email & Password</span>
                </button>
                <button
                  id="signup-tab-phone"
                  type="button"
                  role="tab"
                  aria-selected={signupMethod === "phone"}
                  className={`auth-method-tab ${signupMethod === "phone" ? "auth-method-tab--active" : ""}`}
                  onClick={() => {
                    setSignupMethod("phone");
                    setError("");
                    setPhoneError("");
                  }}
                >
                  <span className="material-symbols-outlined">smartphone</span>
                  <span>Phone Number</span>
                </button>
              </div>

              {signupMethod === "email" ? (
                <>
                  <form onSubmit={handleSubmit} noValidate className="auth-form">
                {/* Email */}
                <div className={`auth-field ${fieldErrors.email ? "auth-field--error" : ""}`}>
                  <label htmlFor="signup-email" className="auth-label">
                    Email address
                  </label>
                  <div className="auth-input-wrap">
                    <span className="material-symbols-outlined auth-input-icon">
                      mail
                    </span>
                    <input
                      id="signup-email"
                      type="email"
                      className="auth-input"
                      placeholder="you@example.com"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setFieldErrors((p) => ({ ...p, email: "" }));
                        setError("");
                      }}
                      aria-describedby={fieldErrors.email ? "signup-email-err" : undefined}
                      aria-invalid={!!fieldErrors.email}
                    />
                  </div>
                  {fieldErrors.email && (
                    <p id="signup-email-err" className="auth-field-error">
                      {fieldErrors.email}
                    </p>
                  )}
                </div>

                {/* Password */}
                <div className={`auth-field ${fieldErrors.password ? "auth-field--error" : ""}`}>
                  <label htmlFor="signup-password" className="auth-label">
                    Password
                  </label>
                  <div className="auth-input-wrap">
                    <span className="material-symbols-outlined auth-input-icon">
                      lock
                    </span>
                    <input
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      className="auth-input auth-input--has-toggle"
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setFieldErrors((p) => ({ ...p, password: "" }));
                        setError("");
                      }}
                      aria-describedby="signup-strength"
                      aria-invalid={!!fieldErrors.password}
                    />
                    <button
                      type="button"
                      className="auth-pw-toggle"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      <span className="material-symbols-outlined">
                        {showPassword ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  </div>

                  {/* Strength meter */}
                  {password && (
                    <div id="signup-strength" className="auth-strength" aria-live="polite">
                      <div className="auth-strength-bar">
                        {[1, 2, 3, 4].map((i) => (
                          <div
                            key={i}
                            className={`auth-strength-segment ${i <= strength ? strengthClasses[strength] : ""}`}
                          />
                        ))}
                      </div>
                      <span className={`auth-strength-label ${strengthClasses[strength]}`}>
                        {strengthLabels[strength]}
                      </span>
                    </div>
                  )}

                  {fieldErrors.password && (
                    <p className="auth-field-error">{fieldErrors.password}</p>
                  )}
                </div>

                {/* Confirm password */}
                <div className={`auth-field ${fieldErrors.confirm ? "auth-field--error" : ""}`}>
                  <label htmlFor="signup-confirm" className="auth-label">
                    Confirm password
                  </label>
                  <div className="auth-input-wrap">
                    <span className="material-symbols-outlined auth-input-icon">
                      lock_check
                    </span>
                    <input
                      id="signup-confirm"
                      type={showConfirm ? "text" : "password"}
                      className="auth-input auth-input--has-toggle"
                      placeholder="Re-enter your password"
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(e) => {
                        setConfirm(e.target.value);
                        setFieldErrors((p) => ({ ...p, confirm: "" }));
                        setError("");
                      }}
                      aria-describedby={fieldErrors.confirm ? "signup-confirm-err" : undefined}
                      aria-invalid={!!fieldErrors.confirm}
                    />
                    <button
                      type="button"
                      className="auth-pw-toggle"
                      onClick={() => setShowConfirm((v) => !v)}
                      aria-label={showConfirm ? "Hide password" : "Show password"}
                    >
                      <span className="material-symbols-outlined">
                        {showConfirm ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  </div>
                  {fieldErrors.confirm && (
                    <p id="signup-confirm-err" className="auth-field-error">
                      {fieldErrors.confirm}
                    </p>
                  )}
                </div>

                {/* Submit */}
                <button
                  id="signup-submit-btn"
                  type="submit"
                  className="auth-btn-primary"
                  disabled={loading || googleLoading}
                >
                  {loading ? (
                    <>
                      <span className="auth-spinner" aria-hidden="true" />
                      Creating account…
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined">person_add</span>
                      Create Account
                    </>
                  )}
                </button>
              </form>

              {/* Divider */}
              <div className="auth-divider">
                <span>or continue with</span>
              </div>

              {/* Google */}
              <button
                id="signup-google-btn"
                type="button"
                className="auth-btn-google"
                onClick={handleGoogle}
                disabled={googleLoading || loading}
              >
                {googleLoading ? (
                  <span className="auth-spinner auth-spinner--dark" aria-hidden="true" />
                ) : (
                  <svg className="auth-google-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                )}
                Continue with Google
              </button>

              {/* Switch to Phone Signup Option */}
              <button
                id="switch-to-phone-signup-btn"
                type="button"
                className="auth-btn-google"
                style={{ marginTop: "10px" }}
                onClick={() => {
                  setSignupMethod("phone");
                  setError("");
                  setPhoneError("");
                }}
              >
                <span className="material-symbols-outlined" style={{ color: "var(--color-primary)" }}>
                  smartphone
                </span>
                Sign up with Phone Number Instead
              </button>

              {/* Footer */}
              <p className="auth-footer-text">
                Already have an account?{" "}
                <button
                  type="button"
                  className="auth-link"
                  onClick={onNavigateToLogin}
                >
                  Sign in
                </button>
              </p>
            </>
          ) : (
            /* ── PHONE SIGNUP WITH OTP VIEW ─────────────── */
            <>
              {phoneStep === "enter_phone" ? (
                <div>
                  {phoneError && (
                    <div className="auth-error-banner" role="alert">
                      <span className="material-symbols-outlined">error</span>
                      <div style={{ flex: 1 }}>
                        <span>{phoneError}</span>
                      </div>
                    </div>
                  )}

                  {/* Informative banner if phone provider is unconfigured on Supabase */}
                  {phoneError &&
                    (phoneError.toLowerCase().includes("sms service is not enabled") ||
                      phoneError.toLowerCase().includes("phone provider")) && (
                      <div className="auth-provider-notice" role="note">
                        <strong>⚠️ SMS Provider Setup Required:</strong>
                        <p style={{ margin: "4px 0 0" }}>
                          Real SMS OTP delivery requires an active SMS provider (e.g. Twilio) configured in your{" "}
                          <strong>Supabase Dashboard &rarr; Authentication &rarr; Providers &rarr; Phone</strong>.
                        </p>
                        <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#78350f" }}>
                          For development and local testing, you can also specify test phone numbers and fixed OTP codes in the Supabase Dashboard under <em>&ldquo;Phone Numbers for Testing&rdquo;</em>.
                        </p>
                      </div>
                    )}

                  {phoneSuccess && (
                    <div className="auth-success-banner" role="status">
                      <span className="material-symbols-outlined">check_circle</span>
                      <span>{phoneSuccess}</span>
                    </div>
                  )}

                  <form onSubmit={handlePhoneSubmit} noValidate className="auth-form">
                    <div className="auth-field">
                      <label htmlFor="phone-number-input" className="auth-label">
                        Mobile Phone Number (India)
                      </label>
                      <div className="auth-phone-input-wrap">
                        <span className="auth-country-badge">🇮🇳 +91</span>
                        <input
                          id="phone-number-input"
                          type="tel"
                          className="auth-phone-input"
                          placeholder="98765 43210"
                          autoComplete="tel-national"
                          value={phone}
                          onChange={(e) => {
                            setPhone(e.target.value);
                            setPhoneError("");
                          }}
                          maxLength={15}
                          autoFocus
                        />
                      </div>
                      <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--color-text-muted)" }}>
                        We will send a 6-digit verification code (OTP) via SMS to verify this number.
                      </p>
                    </div>

                    <button
                      id="phone-signup-send-otp-btn"
                      type="submit"
                      className="auth-btn-primary"
                      disabled={phoneLoading}
                    >
                      {phoneLoading ? (
                        <>
                          <span className="auth-spinner" aria-hidden="true" />
                          Sending OTP…
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined">send_to_mobile</span>
                          Send Verification Code
                        </>
                      )}
                    </button>
                  </form>

                  <div className="auth-divider">
                    <span>or</span>
                  </div>

                  <button
                    id="phone-to-email-btn"
                    type="button"
                    className="auth-btn-google"
                    onClick={() => {
                      setSignupMethod("email");
                      setPhoneError("");
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ color: "var(--color-primary)" }}>
                      mail
                    </span>
                    Use Email &amp; Password Instead
                  </button>

                  <p className="auth-footer-text">
                    Already have an account?{" "}
                    <button
                      id="phone-to-login-btn"
                      type="button"
                      className="auth-link"
                      onClick={onNavigateToLogin}
                    >
                      Sign in
                    </button>
                  </p>
                </div>
              ) : (
                /* Step 2: Verify OTP */
                <div>
                  <div style={{ marginBottom: "1rem", textAlign: "center" }}>
                    <div
                      style={{
                        width: "48px",
                        height: "48px",
                        borderRadius: "50%",
                        background: "var(--color-primary-light, #e8f5e9)",
                        color: "var(--color-primary, #059669)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto 8px",
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "28px" }}>
                        sms
                      </span>
                    </div>
                    <h3 style={{ fontSize: "17px", fontWeight: 700, margin: "0 0 4px" }}>
                      Verify Phone Number
                    </h3>
                    <p style={{ color: "var(--color-text-muted)", fontSize: "13px", margin: "0 0 6px" }}>
                      Enter the 6-digit code sent to <strong>{normalizedPhone}</strong>
                    </p>
                    <button
                      id="phone-change-number-btn"
                      type="button"
                      className="auth-link"
                      style={{ fontSize: "12px", fontWeight: 600 }}
                      onClick={() => {
                        setPhoneStep("enter_phone");
                        setPhoneError("");
                        setOtp("");
                      }}
                    >
                      &larr; Change phone number
                    </button>
                  </div>

                  {phoneError && (
                    <div className="auth-error-banner" role="alert">
                      <span className="material-symbols-outlined">error</span>
                      <div style={{ flex: 1 }}>
                        <span>{phoneError}</span>
                      </div>
                    </div>
                  )}

                  {phoneSuccess && (
                    <div className="auth-success-banner" role="status">
                      <span className="material-symbols-outlined">check_circle</span>
                      <span>{phoneSuccess}</span>
                    </div>
                  )}

                  <form onSubmit={handleVerifyOtp} noValidate className="auth-form">
                    <div className="auth-field">
                      <label htmlFor="phone-otp-input" className="auth-label" style={{ textAlign: "center" }}>
                        6-Digit Verification Code
                      </label>
                      <input
                        id="phone-otp-input"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        className="auth-otp-input"
                        placeholder="••••••"
                        value={otp}
                        onChange={(e) => {
                          setOtp(e.target.value.replace(/\D/g, ""));
                          setPhoneError("");
                        }}
                        autoFocus
                      />
                    </div>

                    <button
                      id="phone-signup-verify-btn"
                      type="submit"
                      className="auth-btn-primary"
                      disabled={otpLoading || otp.length !== 6}
                    >
                      {otpLoading ? (
                        <>
                          <span className="auth-spinner" aria-hidden="true" />
                          Verifying OTP…
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined">verified</span>
                          Verify &amp; Proceed to Dashboard
                        </>
                      )}
                    </button>

                    <div className="auth-resend-row">
                      <span>Didn't get the code?</span>
                      {otpCooldown > 0 ? (
                        <span className="auth-cooldown-badge">
                          <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>
                            timer
                          </span>
                          Resend in {otpCooldown}s
                        </span>
                      ) : (
                        <button
                          id="phone-resend-otp-btn"
                          type="button"
                          className="auth-link"
                          onClick={handleResendOtp}
                          disabled={phoneLoading}
                        >
                          {phoneLoading ? "Sending…" : "Resend OTP"}
                        </button>
                      )}
                    </div>
                  </form>

                  <div className="auth-divider">
                    <span>or</span>
                  </div>

                  <p className="auth-footer-text" style={{ marginTop: "0" }}>
                    <button
                      id="phone-verify-to-login-btn"
                      type="button"
                      className="auth-link"
                      onClick={onNavigateToLogin}
                    >
                      Return to Sign In
                    </button>
                  </p>
                </div>
              )}
            </>
          )}
        </>
      )}

          <div className="auth-legal-links">
            <a href="/privacy" target="_blank" rel="noopener noreferrer">
              Privacy Policy
            </a>
            <span className="auth-legal-divider">•</span>
            <a href="/terms" target="_blank" rel="noopener noreferrer">
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

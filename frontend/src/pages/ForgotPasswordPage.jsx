/**
 * CropWise — Forgot Password Page
 *
 * Sends a Supabase password-reset email. Displays clear feedback
 * whether Supabase is configured or not.
 */

import { useState } from "react";
import { sendPasswordReset } from "../lib/supabaseClient";

export default function ForgotPasswordPage({ onNavigateToLogin }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [fieldError, setFieldError] = useState("");

  function validate() {
    if (!email.trim()) return "Email is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return "Enter a valid email address.";
    return "";
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const err = validate();
    setFieldError(err);
    if (err) return;

    setLoading(true);
    try {
      const { error: authError } = await sendPasswordReset(email.trim());
      if (authError) {
        setError(authError.message);
      } else {
        setSuccess(true);
      }
    } finally {
      setLoading(false);
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
          <h1 className="auth-brand-name">CropWise</h1>
          <p className="auth-brand-sub">AGRICULTURAL INTELLIGENCE</p>
          <div className="auth-brand-divider" />
          <p className="auth-brand-tagline">
            Predict. Optimize. Grow Smarter.
          </p>
        </div>
      </div>

      {/* ── Right form panel ────────────────────────── */}
      <div className="auth-form-panel">
        <div className="auth-card">
          {success ? (
            /* ── Success state ───────────────── */
            <div className="auth-success-state">
              <div className="auth-success-icon">
                <span className="material-symbols-outlined">mark_email_read</span>
              </div>
              <h2 className="auth-card-title">Check your email</h2>
              <p className="auth-card-subtitle">
                If <strong>{email}</strong> is registered, you'll receive a
                password-reset link within a few minutes.
              </p>
              <p className="auth-hint">
                Didn't receive it? Check your spam folder or try again.
              </p>
              <button
                type="button"
                className="auth-btn-primary"
                style={{ marginTop: "1.5rem" }}
                onClick={() => {
                  setSuccess(false);
                  setEmail("");
                }}
              >
                Try a different email
              </button>
              <button
                type="button"
                className="auth-link"
                style={{ marginTop: "1rem", display: "block" }}
                onClick={onNavigateToLogin}
              >
                ← Back to Sign In
              </button>
            </div>
          ) : (
            /* ── Request form ────────────────── */
            <>
              <div className="auth-card-header">
                <div className="auth-back-row">
                  <button
                    type="button"
                    className="auth-back-btn"
                    onClick={onNavigateToLogin}
                    aria-label="Back to sign in"
                  >
                    <span className="material-symbols-outlined">arrow_back</span>
                  </button>
                </div>
                <h2 className="auth-card-title">Reset your password</h2>
                <p className="auth-card-subtitle">
                  Enter the email address associated with your account. We'll
                  send you a link to reset your password.
                </p>
              </div>

              {error && (
                <div className="auth-error-banner" role="alert">
                  <span className="material-symbols-outlined">error</span>
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate className="auth-form">
                <div className={`auth-field ${fieldError ? "auth-field--error" : ""}`}>
                  <label htmlFor="forgot-email" className="auth-label">
                    Email address
                  </label>
                  <div className="auth-input-wrap">
                    <span className="material-symbols-outlined auth-input-icon">
                      mail
                    </span>
                    <input
                      id="forgot-email"
                      type="email"
                      className="auth-input"
                      placeholder="you@example.com"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setFieldError("");
                      }}
                      aria-describedby={fieldError ? "forgot-email-err" : undefined}
                      aria-invalid={!!fieldError}
                    />
                  </div>
                  {fieldError && (
                    <p id="forgot-email-err" className="auth-field-error">
                      {fieldError}
                    </p>
                  )}
                </div>

                <button
                  id="forgot-submit-btn"
                  type="submit"
                  className="auth-btn-primary"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="auth-spinner" aria-hidden="true" />
                      Sending reset link…
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined">send</span>
                      Send Reset Link
                    </>
                  )}
                </button>
              </form>

              <p className="auth-footer-text" style={{ marginTop: "1.5rem" }}>
                Remembered your password?{" "}
                <button
                  type="button"
                  className="auth-link"
                  onClick={onNavigateToLogin}
                >
                  Sign in
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

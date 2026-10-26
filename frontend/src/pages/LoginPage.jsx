/**
 * Quantum Agri — Login Page
 *
 * Email + password sign-in, Google OAuth, and a link to Sign Up.
 * All auth is delegated to Supabase — no mock credentials accepted.
 */

import { useState } from "react";
import { signInWithEmail, signInWithGoogle } from "../lib/supabaseClient";

export default function LoginPage({
  onNavigateToSignup,
  onNavigateToForgot,
  onAuthSuccess,
  oauthError,
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const displayError = error || oauthError;

  function validate() {
    const errs = {};
    if (!email.trim()) errs.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      errs.email = "Enter a valid email address.";
    if (!password) errs.password = "Password is required.";
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const errs = validate();
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      const { data, error: authError } = await signInWithEmail(
        email.trim(),
        password
      );
      if (authError) {
        setError(authError.message);
      } else if (data?.session) {
        onAuthSuccess?.();
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError("");
    setGoogleLoading(true);
    try {
      try {
        sessionStorage.setItem("quantum_agri_auth_intent", "login");
      } catch {
        // ignore
      }
      const { error: authError } = await signInWithGoogle();
      if (authError) setError(authError.message);
      // On success, Supabase redirects the browser — no further action needed here.
    } finally {
      setGoogleLoading(false);
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
            <h2 className="auth-card-title">Welcome back</h2>
            <p className="auth-card-subtitle">
              Sign in to your Quantum Agri workspace
            </p>
          </div>

          {displayError && (
            <div className="auth-error-banner" role="alert">
              <span className="material-symbols-outlined">error</span>
              <span>{displayError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="auth-form">
            {/* Email */}
            <div className={`auth-field ${fieldErrors.email ? "auth-field--error" : ""}`}>
              <label htmlFor="login-email" className="auth-label">
                Email address
              </label>
              <div className="auth-input-wrap">
                <span className="material-symbols-outlined auth-input-icon">
                  mail
                </span>
                <input
                  id="login-email"
                  type="email"
                  className="auth-input"
                  placeholder="you@example.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setFieldErrors((p) => ({ ...p, email: "" }));
                  }}
                  aria-describedby={fieldErrors.email ? "login-email-err" : undefined}
                  aria-invalid={!!fieldErrors.email}
                />
              </div>
              {fieldErrors.email && (
                <p id="login-email-err" className="auth-field-error">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            {/* Password */}
            <div className={`auth-field ${fieldErrors.password ? "auth-field--error" : ""}`}>
              <div className="auth-label-row">
                <label htmlFor="login-password" className="auth-label">
                  Password
                </label>
                <button
                  type="button"
                  className="auth-link auth-forgot-link"
                  onClick={onNavigateToForgot}
                >
                  Forgot password?
                </button>
              </div>
              <div className="auth-input-wrap">
                <span className="material-symbols-outlined auth-input-icon">
                  lock
                </span>
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  className="auth-input auth-input--has-toggle"
                  placeholder="Your password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setFieldErrors((p) => ({ ...p, password: "" }));
                  }}
                  aria-describedby={fieldErrors.password ? "login-pw-err" : undefined}
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
              {fieldErrors.password && (
                <p id="login-pw-err" className="auth-field-error">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              id="login-submit-btn"
              type="submit"
              className="auth-btn-primary"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="auth-spinner" aria-hidden="true" />
                  Signing in…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined">login</span>
                  Sign In
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
            id="login-google-btn"
            type="button"
            className="auth-btn-google"
            onClick={handleGoogle}
            disabled={googleLoading}
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

          {/* Footer link */}
          <p className="auth-footer-text">
            Don't have an account?{" "}
            <button
              type="button"
              className="auth-link"
              onClick={onNavigateToSignup}
            >
              Sign up free
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

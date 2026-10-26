/**
 * Quantum Agri — Auth Context
 *
 * Provides { user, session, loading, authError, clearAuthError } to the application.
 * Manages session persistence and handles OAuth redirect callbacks (code exchange,
 * hash fragments, and error handling) without race conditions.
 */

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { onAuthStateChange, getSession } from "../lib/supabaseClient";
import { parseOAuthCallback } from "../lib/authUtils";

const AuthContext = createContext({
  user: null,
  session: null,
  loading: true,
  authError: null,
  clearAuthError: () => {},
});

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);

  // Initialize authError directly from URL callback params if present
  const [authError, setAuthError] = useState(() => {
    const search = typeof window !== "undefined" ? window.location.search : "";
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const { error: urlError } = parseOAuthCallback(search, hash);

    if (urlError && typeof window !== "undefined" && window.history?.replaceState) {
      try {
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch {
        // ignore
      }
    }

    return urlError;
  });

  // If URL has an explicit error, we do not need to wait in a loading state
  const [loading, setLoading] = useState(() => {
    const search = typeof window !== "undefined" ? window.location.search : "";
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const { error: urlError } = parseOAuthCallback(search, hash);
    return !urlError;
  });

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  useEffect(() => {
    let isMounted = true;

    // Detect OAuth parameters from current window URL
    const search = typeof window !== "undefined" ? window.location.search : "";
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const { isOAuthReturn, hasCode, hasToken, error: urlError } = parseOAuthCallback(search, hash);

    if (urlError) {
      // urlError was already set in useState initializers; skip subscription setup on fatal OAuth error
      return;
    }

    // Subscribe to auth state changes as authoritative listener
    const unsubscribe = onAuthStateChange((event, newSession) => {
      if (!isMounted) return;

      if (newSession) {
        setSession(newSession);
        setAuthError(null);
        setLoading(false);

        // Once session is confirmed, clean the URL parameters if returning from OAuth
        if (typeof window !== "undefined" && (window.location.search || window.location.hash)) {
          if (window.history?.replaceState) {
            try {
              window.history.replaceState({}, document.title, window.location.pathname);
            } catch {
              // ignore
            }
          }
        }
      } else {
        // If an explicit sign-out event occurred, update session
        if (event === "SIGNED_OUT") {
          setSession(null);
          setLoading(false);
        } else if (!isOAuthReturn) {
          // Only clear loading on null session if NOT waiting for an in-flight OAuth code exchange
          setSession(null);
          setLoading(false);
        }
      }
    });

    if (isOAuthReturn && (hasCode || hasToken)) {
      // OAuth exchange is in progress: keep loading=true while Supabase processes the redirect.
      // Set a safety timeout so app does not hang indefinitely if code is invalid or expired.
      const timer = setTimeout(() => {
        if (isMounted) {
          getSession().then(({ data, error }) => {
            if (!isMounted) return;
            if (data?.session) {
              setSession(data.session);
            } else if (error) {
              setAuthError(error.message);
            }
            setLoading(false);
          });
        }
      }, 5000);

      return () => {
        isMounted = false;
        clearTimeout(timer);
        unsubscribe();
      };
    }

    // Standard cold load (not an OAuth return): restore cached session
    getSession().then(({ data, error }) => {
      if (!isMounted) return;
      if (data?.session) {
        setSession(data.session);
      } else if (error) {
        setAuthError(error.message);
      }
      setLoading(false);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        session,
        loading,
        authError,
        clearAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}

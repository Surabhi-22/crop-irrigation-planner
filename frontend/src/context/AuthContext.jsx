/**
 * Quantum Agri — Auth Context
 *
 * Provides { user, session, loading } to the entire app and restores
 * the user's session on page reload via Supabase's built-in persistence.
 */

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChange, getSession } from "../lib/supabaseClient";

const AuthContext = createContext({
  user: null,
  session: null,
  loading: true,
});

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore existing session on mount
    getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setLoading(false);
    });

    // Subscribe to future auth events (login, logout, token refresh)
    const unsubscribe = onAuthStateChange((newSession) => {
      setSession(newSession);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider
      value={{ user: session?.user ?? null, session, loading }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}

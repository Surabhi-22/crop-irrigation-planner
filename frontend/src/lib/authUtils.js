/**
 * Pure utility functions for OAuth redirect handling, error extraction, and URL sanitation.
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

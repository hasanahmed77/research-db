import type { AuthError } from "@supabase/supabase-js";

/**
 * Did getUser fail for a reason other than "there is no session"?
 *
 * Being signed out is itself reported as an error (AuthSessionMissingError,
 * status 400), so treating every error as transient makes a stale cookie look
 * like a live session. Only a network failure or a server fault counts.
 */
export function isTransientAuthError(error: AuthError | null): boolean {
  if (!error) return false;
  if (error.name === "AuthRetryableFetchError") return true;
  const status = error.status;
  return status === undefined || status === 0 || status >= 500;
}

/**
 * The session cookie supabase-ssr writes, whatever the project ref, allowing
 * for the .0/.1 chunks it splits large sessions into.
 *
 * An abandoned sign-in leaves sb-<ref>-auth-token-...-code-verifier cookies
 * behind. They match on "auth-token" but carry no session, and counting them
 * makes a signed-out visitor look signed in.
 */
export function hasSessionCookie(names: string[]): boolean {
  return names.some(
    (n) => n.startsWith("sb-") && n.includes("auth-token") && !n.includes("code-verifier"),
  );
}

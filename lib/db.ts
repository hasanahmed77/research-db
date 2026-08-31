/**
 * Unwrap a Supabase result, throwing on failure so the route's error boundary
 * sees it. Destructuring only `data` swallows the error and renders the page as
 * though it were simply empty, which is indistinguishable from a paper with no
 * tags or a library with no papers.
 */
export function must<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

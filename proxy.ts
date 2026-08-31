import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { hasSessionCookie, isTransientAuthError } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { pathname } = request.nextUrl;
  // /auth/* carries the OAuth callback, which runs before a session exists
  const isPublic =
    pathname.startsWith("/login") || pathname.startsWith("/auth") || pathname === "/about";

  const { data, error } = await supabase.auth.getUser();

  // A failure to reach the auth server is not the same as being signed out.
  // Without this, a blip logs you out visually and drops you on the marketing
  // page mid-session. Being signed out is itself reported as an error, so only
  // a genuinely transient one counts.
  if (
    !data.user &&
    isTransientAuthError(error) &&
    hasSessionCookie(request.cookies.getAll().map((c) => c.name))
  ) {
    return response;
  }

  if (!data.user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

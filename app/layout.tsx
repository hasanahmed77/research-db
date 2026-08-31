import "./globals.css";
import Link from "next/link";
import type { Metadata } from "next";
import { Chakra_Petch, Spectral } from "next/font/google";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import { hasSessionCookie, isTransientAuthError } from "@/lib/auth";
import { Fracture } from "@/components/Fracture";

const chakra = Chakra_Petch({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-chakra",
});

// A light serif: formal against the technical chrome of everything else
const spectral = Spectral({
  subsets: ["latin"],
  weight: ["300", "400"],
  variable: "--font-logo",
});

export const metadata: Metadata = {
  title: "Research/db",
  description: "Build your personal research library, one paper at a time.",
};

const icon = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();

  // Same reasoning as proxy.ts: a network or server fault is not a signed-out
  // user, and rendering the signed-out nav mid-session is how "it says I am
  // logged out" happens. A missing session is not such a fault.
  const store = await cookies();
  const signedIn =
    Boolean(data.user) ||
    (isTransientAuthError(error) && hasSessionCookie(store.getAll().map((c) => c.name)));

  return (
    <html lang="en" className={`${chakra.variable} ${spectral.variable}`}>
      <body className="flex min-h-screen flex-col antialiased">
        <Fracture />
        <header className="glass slide-from-top sticky top-0 z-20 border-x-0 border-t-0">
          <nav className="mx-auto flex max-w-5xl items-center gap-1 px-4 py-4 text-sm">
            <Link href="/" className="logo text-xl">
              Research<span className="text-accent">/</span>db
            </Link>
            <div className="ml-auto flex items-center gap-1">
              {signedIn ? (
                <>
                  <Link href="/about" className="nav-icon" aria-label="About" title="About">
                    <svg width="19" height="19" viewBox="0 0 24 24" {...icon}>
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 11v5.5" />
                      <path d="M12 7.6v.9" />
                    </svg>
                  </Link>
                  <Link href="/graph" className="nav-icon" aria-label="Graph" title="Graph">
                    <svg width="19" height="19" viewBox="0 0 24 24" {...icon}>
                      <circle cx="6" cy="6" r="2.4" />
                      <circle cx="18" cy="9" r="2.4" />
                      <circle cx="9" cy="18" r="2.4" />
                      <path d="M8.1 7.1 15.9 8.4M7.3 8 8.3 15.7M11.2 17.2 16.6 11" />
                    </svg>
                  </Link>
                  <Link href="/papers/new" className="nav-icon" aria-label="Add paper" title="Add paper">
                    <svg width="19" height="19" viewBox="0 0 24 24" {...icon}>
                      <path d="M13.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5z" />
                      <path d="M13.5 3v5.5H19" />
                      <path d="M12 12.5v5M9.5 15h5" />
                    </svg>
                  </Link>
                  <form action="/auth/signout" method="post">
                    <button className="nav-icon" aria-label="Sign out" title="Sign out">
                      <svg width="19" height="19" viewBox="0 0 24 24" {...icon}>
                        <path d="M9.5 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4.5" />
                        <path d="M16 16.5 20.5 12 16 7.5" />
                        <path d="M20.5 12H9.5" />
                      </svg>
                    </button>
                  </form>
                </>
              ) : (
                <span
                  className="cursor-help select-none px-2 text-lg italic tracking-[0.2em]
                             text-muted transition-colors hover:text-accent"
                  title="Sign in to unlock your library, your notes and the graph"
                >
                  ???
                </span>
              )}
            </div>
          </nav>
          {/* thin accent rule under the bar */}
          <div className="h-px bg-gradient-to-r from-accent/60 via-cyan/25 to-transparent" />
        </header>
        <main className="flex flex-1 flex-col overflow-x-clip px-4 py-8">{children}</main>

        {/* the wrapper keeps the footer's height in flow and clips the slide, so
            sliding up from below does not add page scroll for the animation's
            duration. clip rather than hidden, to avoid a scroll container. */}
        <div className="overflow-clip">
        <footer className="glass slide-from-bottom border-x-0 border-b-0">
          <div className="mx-auto flex max-w-5xl flex-wrap items-end gap-x-10 gap-y-6 px-4 py-8
                          text-xs text-muted">
            <div className="space-y-1.5">
              <p className="logo text-base text-fg">
                Research<span className="text-accent">/</span>db
              </p>
              <p>a library you fill one paper at a time</p>
            </div>

            {signedIn && (
              <nav className="flex flex-wrap gap-x-5 gap-y-2">
                <Link href="/about" className="transition-colors hover:text-accent">about</Link>
                <Link href="/" className="transition-colors hover:text-accent">library</Link>
                <Link href="/graph" className="transition-colors hover:text-accent">graph</Link>
                <Link href="/papers/new" className="transition-colors hover:text-accent">add paper</Link>
              </nav>
            )}

            <a href="https://github.com/hasanahmed77/research-db" target="_blank" rel="noreferrer"
               className="ml-auto transition-colors hover:text-accent"
               aria-label="Source on GitHub" title="Source on GitHub">
              <svg width="19" height="19" viewBox="0 0 16 16" fill="currentColor" aria-hidden
                   focusable="false">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
              </svg>
            </a>
          </div>
        </footer>
        </div>
      </body>
    </html>
  );
}

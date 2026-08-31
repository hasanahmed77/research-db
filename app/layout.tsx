import "./globals.css";
import Link from "next/link";
import type { Metadata } from "next";
import { Chakra_Petch } from "next/font/google";
import { supabaseServer } from "@/lib/supabase/server";

const chakra = Chakra_Petch({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-chakra",
});

export const metadata: Metadata = { title: "research-db" };

const icon = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();

  return (
    <html lang="en" className={chakra.variable}>
      <body className="min-h-screen antialiased">
        <header className="border-b border-line bg-surface/80 backdrop-blur">
          <nav className="mx-auto flex max-w-5xl items-center gap-1 px-4 py-4 text-sm">
            <Link href="/" className="font-display text-base font-semibold tracking-wide">
              research<span className="text-accent">/</span>db
            </Link>
            {data.user && (
              <div className="ml-auto flex items-center gap-1">
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
              </div>
            )}
          </nav>
          {/* thin accent rule under the bar */}
          <div className="h-px bg-gradient-to-r from-accent/60 via-cyan/25 to-transparent" />
        </header>
        <main className="px-4 py-8">{children}</main>
      </body>
    </html>
  );
}

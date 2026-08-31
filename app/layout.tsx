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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();

  return (
    <html lang="en" className={chakra.variable}>
      <body className="min-h-screen antialiased">
        <header className="border-b border-line bg-surface/80 backdrop-blur">
          <nav className="mx-auto flex max-w-5xl items-center gap-5 px-4 py-3 text-sm">
            <Link href="/" className="font-display font-semibold tracking-wide">
              research<span className="text-accent">/</span>db
            </Link>
            {data.user && (
              <>
                <Link href="/papers/new" className="btn-ghost">
                  add paper
                </Link>
                <form action="/auth/signout" method="post" className="ml-auto">
                  <button className="btn-ghost">sign out</button>
                </form>
              </>
            )}
          </nav>
          {/* thin accent rule under the bar */}
          <div className="h-px bg-gradient-to-r from-accent/60 via-cyan/25 to-transparent" />
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}

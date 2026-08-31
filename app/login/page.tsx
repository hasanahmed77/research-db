import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

async function signInWithGoogle() {
  "use server";
  const supabase = await supabaseServer();
  const h = await headers();
  // works unchanged on localhost and on the deployed origin
  const origin =
    h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` },
  });

  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect(data.url);
}

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="mx-auto mt-16 max-w-sm space-y-4">
      <h1 className="font-display text-xl font-semibold tracking-wide">Sign in</h1>
      {error && <p className="border border-danger/50 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      <form action={signInWithGoogle}>
        <button className="btn w-full">Continue with Google</button>
      </form>
    </div>
  );
}

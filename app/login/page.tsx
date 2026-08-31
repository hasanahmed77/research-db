import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { AboutCopy } from "@/components/AboutCopy";

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
    <div className="flex flex-1 items-center justify-center px-4">
      <div className="grid w-full max-w-6xl items-center gap-12 md:grid-cols-5 md:gap-16">
        <div className="md:col-span-3">
          <AboutCopy variant="hero" />
        </div>

        {/* the border and padding belong to the column; the block centres inside it */}
        <div className="flex justify-center md:col-span-2 md:border-l md:border-line md:px-12">
          <div className="w-full max-w-sm space-y-5 text-center">
            <h1 className="font-display text-xl font-semibold tracking-wide">Sign in</h1>
            {error && (
              <p className="border border-danger/50 bg-danger/10 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}
            <form action={signInWithGoogle}>
              <button className="btn w-full">Continue with Google</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

async function signIn(fd: FormData) {
  "use server";
  const supabase = await supabaseServer();
  const email = String(fd.get("email") ?? "");
  const password = String(fd.get("password") ?? "");
  const mode = String(fd.get("mode") ?? "in");

  const { error } =
    mode === "up"
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect("/");
}

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
      <h1 className="text-lg font-medium">Sign in</h1>
      {error && <p className="text-sm text-red-500">{error}</p>}

      <form action={signInWithGoogle}>
        <button className="btn w-full">Continue with Google</button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" />
      </div>

      <form action={signIn} className="space-y-3">
        <input className="field" name="email" type="email" placeholder="email" required />
        <input className="field" name="password" type="password" placeholder="password" required />
        <div className="flex gap-2">
          <button className="btn" name="mode" value="in">Sign in</button>
          <button className="btn" name="mode" value="up">Create account</button>
        </div>
      </form>
    </div>
  );
}

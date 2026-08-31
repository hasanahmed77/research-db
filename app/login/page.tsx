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

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <form action={signIn} className="mx-auto mt-16 max-w-sm space-y-3">
      <h1 className="text-lg font-medium">Sign in</h1>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <input className="field" name="email" type="email" placeholder="email" required />
      <input className="field" name="password" type="password" placeholder="password" required />
      <div className="flex gap-2">
        <button className="btn" name="mode" value="in">Sign in</button>
        <button className="btn" name="mode" value="up">Create account</button>
      </div>
    </form>
  );
}

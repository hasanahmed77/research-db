import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { siteOrigin } from "@/lib/site";
import { AboutCopy } from "@/components/AboutCopy";

async function signInWithGoogle() {
  "use server";

  // redirect() works by throwing, so both calls stay outside the try — catching
  // them would swallow the navigation. Anything that goes wrong here used to
  // surface as a bare 500 with no way to see the cause.
  let url: string | null = null;
  let failure: string | null = null;

  try {
    const supabase = await supabaseServer();
    const origin = await siteOrigin();

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${origin}/auth/callback` },
    });

    if (error) throw new Error(error.message);
    if (!data?.url) throw new Error("Supabase returned no authorize url");
    url = data.url;
  } catch (e) {
    failure = e instanceof Error ? e.message : "sign in failed";
  }

  if (failure) redirect(`/login?error=${encodeURIComponent(failure)}`);
  redirect(url!);
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
              <button className="btn w-full gap-2.5" aria-label="Continue with Google">
                Continue with
                {/* Google's own mark, unmodified, as their branding requires */}
                <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden focusable="false">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

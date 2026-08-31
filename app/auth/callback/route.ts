import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { siteOrigin } from "@/lib/site";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  // not new URL(request.url).origin: behind a proxy that is the internal host
  const origin = await siteOrigin();
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error_description") ?? searchParams.get("error");

  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/`);
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent(oauthError ?? "no code returned")}`,
  );
}

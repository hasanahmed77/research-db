import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { siteOrigin } from "@/lib/site";

export async function POST() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  return NextResponse.redirect(`${await siteOrigin()}/login`, { status: 303 });
}

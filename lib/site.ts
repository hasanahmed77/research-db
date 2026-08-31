import { headers } from "next/headers";

/**
 * The origin the browser actually used.
 *
 * Behind a proxy — Vercel included — request.url and the host header carry the
 * internal address, so an OAuth redirect built from them lands on the wrong
 * host. The x-forwarded-* pair is what the browser really asked for.
 * NEXT_PUBLIC_SITE_URL overrides both when it is set.
 */
export async function siteOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

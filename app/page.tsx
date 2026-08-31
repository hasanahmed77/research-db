import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { STATUSES, type PaperCard } from "@/lib/types";

/** read = done, reading = in flight; everything else stays quiet */
const statusChip = (s: string) =>
  s === "read" ? "chip chip-accent" : s === "reading" ? "chip chip-cyan" : "chip";

type Search = { q?: string; status?: string; from?: string; to?: string; stubs?: string };

export default async function Library({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const supabase = await supabaseServer();
  const q = sp.q?.trim() ?? "";
  const includeStubs = sp.stubs === "1";

  let cards: PaperCard[] = [];
  let snippets = new Map<string, string>();

  if (q) {
    // filters go into the RPC so they apply before the rank cut
    const { data: hits } = await supabase.rpc("search_papers", {
      q,
      max_results: 100,
      filter_status: sp.status || null,
      year_from: sp.from ? Number(sp.from) : null,
      year_to: sp.to ? Number(sp.to) : null,
      tag_ids: null,
      include_stubs: includeStubs,
    });

    const ids: string[] = (hits ?? []).map((h: { id: string }) => h.id);
    snippets = new Map((hits ?? []).map((h: { id: string; snippet: string }) => [h.id, h.snippet]));

    if (ids.length) {
      const { data } = await supabase.from("paper_cards").select("*").in("id", ids);
      const order = new Map<string, number>(ids.map((id, i) => [id, i]));
      cards = (data ?? []).sort((a, b) => order.get(a.id)! - order.get(b.id)!);
    }
  } else {
    let query = supabase.from("paper_cards").select("*").order("created_at", { ascending: false }).limit(100);
    if (sp.status) query = query.eq("status", sp.status);
    if (sp.from) query = query.gte("year", Number(sp.from));
    if (sp.to) query = query.lte("year", Number(sp.to));
    if (!includeStubs) query = query.eq("is_stub", false);
    const { data } = await query;
    cards = data ?? [];
  }

  return (
    <div className="space-y-5">
      <form className="flex flex-wrap items-center gap-2">
        <input className="field flex-1 min-w-56" name="q" defaultValue={q}
               placeholder="title, abstract, your notes, author, tag, cite key…" />
        <select className="field w-32" name="status" defaultValue={sp.status ?? ""}>
          <option value="">any status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>
        <input className="field w-20" name="from" defaultValue={sp.from ?? ""} placeholder="from" />
        <input className="field w-20" name="to" defaultValue={sp.to ?? ""} placeholder="to" />
        <label className="chip cursor-pointer">
          <input type="checkbox" name="stubs" value="1" defaultChecked={includeStubs} /> stubs
        </label>
        <button className="btn">search</button>
      </form>

      <p className="label">{cards.length} paper{cards.length === 1 ? "" : "s"}</p>

      <ul className="divide-y divide-line border-y border-line">
        {cards.map((p) => (
          <li key={p.id} className="card py-3">
            <Link href={`/papers/${p.id}`}
                  className="font-display font-semibold tracking-wide transition-colors hover:text-accent">
              {p.title}
            </Link>
            <p className="mt-0.5 text-sm text-muted">
              {[p.authors?.join(", "), p.venue, p.year].filter(Boolean).join(" · ")}
            </p>
            {snippets.get(p.id) && (
              <p className="mt-1 text-sm text-muted"
                 dangerouslySetInnerHTML={{ __html: snippets.get(p.id)! }} />
            )}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className={statusChip(p.is_stub ? "stub" : p.status)}>
                {p.is_stub ? "stub" : p.status.replace("_", " ")}
              </span>
              <span className="chip">notes {p.notes_filled}/{p.notes_total}</span>
              {p.cites_out > 0 && <span className="chip">cites {p.cites_out}</span>}
              {p.cited_by > 0 && <span className="chip">cited by {p.cited_by}</span>}
              {p.tags?.map((t) => <span key={t} className="chip">{t}</span>)}
            </div>
          </li>
        ))}
      </ul>

      {cards.length === 0 && (
        <p className="text-sm text-muted">
          Nothing here. <Link href="/papers/new" className="underline">Add a paper</Link>.
        </p>
      )}
    </div>
  );
}

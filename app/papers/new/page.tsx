import { createPaper } from "@/app/actions";
import { supabaseServer } from "@/lib/supabase/server";
import { LINK_TYPES, TAG_KINDS, TAG_ROLES } from "@/lib/types";

export default async function NewPaper() {
  const supabase = await supabaseServer();
  const { data: papers } = await supabase.from("papers").select("id, title, cite_key").limit(500);

  return (
    <form action={createPaper} className="max-w-3xl space-y-8">
      <h1 className="font-display text-xl font-semibold tracking-wide">Add a paper</h1>

      <section className="space-y-3">
        <h2 className="label">The paper</h2>
        <label className="block space-y-1">
          <span className="text-xs text-muted">title — the only thing required</span>
          <input className="field" name="title" required autoFocus />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-muted">abstract <span className="opacity-60">(optional)</span></span>
          <textarea className="field" name="abstract" rows={4} />
        </label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["year", "year", "numeric"],
            ["cite_key", "cite key", ""],
            ["arxiv_id", "arXiv id", ""],
            ["doi", "DOI", ""],
          ].map(([name, caption, mode]) => (
            <label key={name} className="block space-y-1">
              <span className="text-xs text-muted">{caption} <span className="opacity-60">(optional)</span></span>
              <input className="field" name={name} inputMode={mode === "numeric" ? "numeric" : undefined} />
            </label>
          ))}
        </div>
        <label className="block space-y-1">
          <span className="text-xs text-muted">url <span className="opacity-60">(optional)</span></span>
          <input className="field" name="url" />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" name="is_stub" />
          stub — a reference I have not read, kept only for the citation graph
        </label>
      </section>

      <section className="space-y-3">
        <h2 className="label">First tag <span className="normal-case opacity-60">(optional)</span></h2>
        <div className="flex flex-wrap items-center gap-2">
          <input className="field w-48" name="name" placeholder="tag" />
          <select className="field w-32" name="kind">
            {TAG_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <select className="field w-40" name="role">
            {TAG_ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
          </select>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="label">First link <span className="normal-case opacity-60">(optional)</span></h2>
        <div className="flex flex-wrap items-center gap-2">
          <select className="field w-40" name="edge_kind">
            <option value="cites">cites</option>
            {LINK_TYPES.map((k) => <option key={k} value={k}>{k.replace(/_/g, " ")}</option>)}
          </select>
          <input className="field w-72" name="target" list="paper-list"
                 placeholder="pick from your library, or type a new title" />
          <datalist id="paper-list">
            {(papers ?? []).map((p) => (
              <option key={p.id} value={p.cite_key ?? p.title}>{p.title}</option>
            ))}
          </datalist>
          <input className="field w-56" name="note" placeholder="why" />
          <label className="field flex w-auto cursor-pointer items-center gap-2 whitespace-nowrap"
                 title="If the title above is not in your library, add it as a stub and link it">
            <input type="checkbox" name="stub" />
            new stub
          </label>
        </div>
      </section>

      <button className="btn">Add</button>
    </form>
  );
}

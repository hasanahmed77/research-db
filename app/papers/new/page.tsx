import { createPaper, findPapers } from "@/app/actions";
import { PaperPicker } from "@/components/PaperPicker";
import { EDGE_KINDS } from "@/lib/types";

export default function NewPaper() {
  return (
    <form action={createPaper} className="mx-auto max-w-3xl space-y-8">
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
        <h2 className="label">Tags <span className="normal-case opacity-60">(optional)</span></h2>
        <input className="field" name="name" placeholder="tag, another tag — comma separated" />
      </section>

      <section className="space-y-3">
        <h2 className="label">Links <span className="normal-case opacity-60">(optional)</span></h2>
        <select className="field w-40" name="edge_kind">
          {EDGE_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <PaperPicker name="to_ids" search={findPapers} />
      </section>

      <button className="btn">Add</button>
    </form>
  );
}

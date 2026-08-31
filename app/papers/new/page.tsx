import { createPaper } from "@/app/actions";

export default function NewPaper() {
  return (
    <form action={createPaper} className="max-w-2xl space-y-3">
      <h1 className="font-display text-xl font-semibold tracking-wide">Add a paper</h1>
      <input className="field" name="title" placeholder="title" required autoFocus />
      <textarea className="field" name="abstract" rows={4} placeholder="abstract" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <input className="field" name="year" placeholder="year" inputMode="numeric" />
        <input className="field" name="cite_key" placeholder="cite key" />
        <input className="field" name="arxiv_id" placeholder="arXiv id" />
        <input className="field" name="doi" placeholder="DOI" />
      </div>
      <input className="field" name="url" placeholder="url" />
      <label className="flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" name="is_stub" />
        stub — a reference I have not read, kept only for the citation graph
      </label>
      <button className="btn btn-primary">Add</button>
    </form>
  );
}

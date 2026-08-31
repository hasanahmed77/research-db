import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { AutoSave } from "@/components/AutoSave";
import { PdfUpload } from "@/components/PdfUpload";
import {
  addEdge, addExcerpt, addTag, deleteExcerpt, removeEdge, removeTag, saveNote, updatePaper,
} from "@/app/actions";
import { LINK_TYPES, STATUSES, TAG_KINDS, TAG_ROLES } from "@/lib/types";

export default async function PaperPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();

  const { data: paper } = await supabase
    .from("papers").select("*, venues(name, short_name)").eq("id", id).maybeSingle();
  if (!paper) notFound();

  const [{ data: prompts }, { data: notes }, { data: paperTags }, { data: excerpts },
         { data: edges }, { data: authors }, { data: allPapers }] = await Promise.all([
    supabase.from("note_prompts").select("id, key, title, guidance, ord").eq("is_active", true).order("ord"),
    supabase.from("paper_notes").select("prompt_id, body").eq("paper_id", id),
    supabase.from("paper_tags").select("role, tags(id, name, kind)").eq("paper_id", id),
    supabase.from("excerpts").select("id, page, quote, comment").eq("paper_id", id).order("page", { nullsFirst: false }),
    supabase.rpc("paper_graph", { root: id, depth: 1 }),
    supabase.from("paper_authors").select("ord, authors(name)").eq("paper_id", id).order("ord"),
    supabase.from("papers").select("id, title, cite_key").limit(500),
  ]);

  const noteBy = new Map((notes ?? []).map((n) => [n.prompt_id, n.body]));
  const titleById = new Map((allPapers ?? []).map((p) => [p.id, p.title]));
  const answered = (prompts ?? []).filter((p) => (noteBy.get(p.id) ?? "").trim()).length;

  type Edge = { source: string; target: string; rel: string };
  const neighbours = ((edges ?? []) as Edge[]).map((e) => {
    const outgoing = e.source === id;
    return {
      otherId: outgoing ? e.target : e.source,
      rel: e.rel,
      dir: outgoing ? "→" : "←",
      title: titleById.get(outgoing ? e.target : e.source) ?? "(unknown)",
      from: e.source,
      to: e.target,
    };
  });

  const pdfUrl = paper.pdf_path
    ? (await supabase.storage.from("papers").createSignedUrl(paper.pdf_path, 3600)).data?.signedUrl
    : null;

  return (
    <div className="space-y-10">
      <section className="space-y-2">
        <AutoSave action={updatePaper} hidden={{ id, field: "title" }} name="value"
                  defaultValue={paper.title} className="field text-lg font-medium" />
        <p className="text-sm text-muted">
          {[(authors ?? []).map((a) => (a.authors as unknown as { name: string } | null)?.name).filter(Boolean).join(", "),
            (paper.venues as { short_name: string } | null)?.short_name,
            paper.year].filter(Boolean).join(" · ")}
        </p>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <AutoSave action={updatePaper} hidden={{ id, field: "status" }} name="value" label="status"
                    as="select" options={STATUSES} defaultValue={paper.status} className="quiet w-32" />
          <AutoSave action={updatePaper} hidden={{ id, field: "cite_key" }} name="value" label="cite key"
                    defaultValue={paper.cite_key ?? ""} placeholder="—" className="quiet w-40" />
          {pdfUrl && <a className="btn" href={pdfUrl} target="_blank" rel="noreferrer">open pdf</a>}
          <PdfUpload paperId={id} action={updatePaper} />
          {paper.url && <a className="btn" href={paper.url} target="_blank" rel="noreferrer">link</a>}
          {paper.arxiv_id && (
            <a className="btn" href={`https://arxiv.org/abs/${paper.arxiv_id}`} target="_blank" rel="noreferrer">arXiv</a>
          )}
          {paper.doi && (
            <a className="btn" href={`https://doi.org/${paper.doi}`} target="_blank" rel="noreferrer">doi</a>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="label">Summary</h2>
        <AutoSave action={updatePaper} hidden={{ id, field: "summary" }} name="value"
                  as="textarea" rows={3} defaultValue={paper.summary ?? ""}
                  placeholder="the paper in your own words" />
      </section>

      <section className="space-y-6">
        <h2 className="label">Reading questions · {answered}/{(prompts ?? []).length}</h2>
        {(prompts ?? []).map((p) => {
          const body = (noteBy.get(p.id) ?? "").trim();
          const editor = (
            <>
              {p.guidance && <p className="text-xs leading-relaxed text-muted">{p.guidance}</p>}
              <AutoSave action={saveNote} hidden={{ paper_id: id, prompt_id: p.id }} name="body"
                        as="textarea" rows={4} defaultValue={noteBy.get(p.id) ?? ""} />
            </>
          );
          return (
            <div key={p.id} className="space-y-2">
              <h3 className="font-display text-sm font-semibold tracking-wide">
                <span className={body ? "text-accent" : "text-muted"}>
                  {String(p.ord).padStart(2, "0")}
                </span>{" "}
                {p.title}
              </h3>
              {/* answered questions read as prose; the editor is one click away */}
              {body ? (
                <>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{body}</p>
                  <details>
                    <summary className="disclosure text-xs">edit</summary>
                    <div className="space-y-2 pt-2">{editor}</div>
                  </details>
                </>
              ) : (
                <div className="space-y-2">{editor}</div>
              )}
            </div>
          );
        })}
      </section>

      <section className="space-y-3">
        <h2 className="label">Tags</h2>
        {(paperTags ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {(paperTags ?? []).map((pt) => {
              const t = pt.tags as unknown as { id: string; name: string; kind: string };
              return (
                <form key={`${t.id}-${pt.role}`} action={removeTag} className="chip">
                  <input type="hidden" name="paper_id" value={id} />
                  <input type="hidden" name="tag_id" value={t.id} />
                  <input type="hidden" name="role" value={pt.role} />
                  <span>{t.name}</span>
                  <span className="opacity-60">{t.kind}</span>
                  {pt.role !== "about" && <span className="opacity-60">· {pt.role.replace(/_/g, " ")}</span>}
                  <button className="btn-sm" aria-label="remove">×</button>
                </form>
              );
            })}
          </div>
        )}
        <details>
          <summary className="disclosure">+ tag</summary>
          <form action={addTag} className="flex flex-wrap items-center gap-2 pt-3">
            <input type="hidden" name="paper_id" value={id} />
            <input className="field w-48" name="name" placeholder="tag" required />
            <select className="field w-32" name="kind">
              {TAG_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
            <select className="field w-40" name="role">
              {TAG_ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
            </select>
            <button className="btn">add</button>
          </form>
        </details>
      </section>

      <section className="space-y-3">
        <h2 className="label">Graph</h2>
        {neighbours.length > 0 ? (
          <ul className="space-y-1 text-sm">
            {neighbours.map((n, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className={`chip ${n.rel === "cites" ? "" : "chip-cyan"}`}>
                  {n.rel.replace(/_/g, " ")} {n.dir}
                </span>
                <Link href={`/papers/${n.otherId}`} className="hover:text-accent">{n.title}</Link>
                <form action={removeEdge}>
                  <input type="hidden" name="from_id" value={n.from} />
                  <input type="hidden" name="to_id" value={n.to} />
                  <input type="hidden" name="kind" value={n.rel} />
                  <button className="btn-sm" aria-label="remove">×</button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No edges yet.</p>
        )}
        <details>
          <summary className="disclosure">+ link</summary>
          <form action={addEdge} className="flex flex-wrap items-center gap-2 pt-3">
            <input type="hidden" name="paper_id" value={id} />
            <select className="field w-40" name="kind">
              <option value="cites">cites</option>
              {LINK_TYPES.map((k) => <option key={k} value={k}>{k.replace(/_/g, " ")}</option>)}
            </select>
            <input className="field w-72" name="target" list="paper-list"
                   placeholder="pick from your library, or type a new title" required />
            <datalist id="paper-list">
              {(allPapers ?? []).filter((p) => p.id !== id).map((p) => (
                <option key={p.id} value={p.cite_key ?? p.title}>{p.title}</option>
              ))}
            </datalist>
            <input className="field w-56" name="note" placeholder="why (optional)" />
            <label className="field flex w-auto cursor-pointer items-center gap-2 whitespace-nowrap"
                   title="If the title above is not in your library, add it as a stub and link it">
              <input type="checkbox" name="stub" />
              new stub
            </label>
            <button className="btn">link</button>
          </form>
        </details>
      </section>

      <section className="space-y-3">
        <h2 className="label">Excerpts</h2>
        {(excerpts ?? []).length > 0 && (
          <ul className="space-y-3 text-sm">
            {(excerpts ?? []).map((e) => (
              <li key={e.id} className="card">
                <p>“{e.quote}”{e.page && <span className="text-muted"> — p.{e.page}</span>}</p>
                {e.comment && <p className="text-muted">{e.comment}</p>}
                <form action={deleteExcerpt} className="pt-1">
                  <input type="hidden" name="id" value={e.id} />
                  <input type="hidden" name="paper_id" value={id} />
                  <button className="btn-sm">remove</button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <details>
          <summary className="disclosure">+ excerpt</summary>
          <form action={addExcerpt} className="flex flex-wrap items-center gap-2 pt-3">
            <input type="hidden" name="paper_id" value={id} />
            <input className="field w-16" name="page" placeholder="p." inputMode="numeric" />
            <input className="field flex-1 min-w-64" name="quote" placeholder="quote" required />
            <input className="field w-56" name="comment" placeholder="comment" />
            <button className="btn">add</button>
          </form>
        </details>
      </section>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { must } from "@/lib/db";
import { AutoSave } from "@/components/AutoSave";
import { NotesEditor } from "@/components/NotesEditor";
import { PaperPicker } from "@/components/PaperPicker";
import { DeletePaper } from "@/components/DeletePaper";
import { EditableTitle } from "@/components/EditableTitle";
import { PdfUpload } from "@/components/PdfUpload";
import {
  addEdge, addExcerpt, addTag, deleteExcerpt, deletePaper, findPapers, removeEdge, removeTag,
  saveNotes, updatePaper,
} from "@/app/actions";
import { EDGE_KINDS, STATUSES } from "@/lib/types";

export default async function PaperPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();

  const paper = must(
    await supabase.from("papers").select("*, venues(name, short_name)").eq("id", id).maybeSingle(),
  );
  if (!paper) notFound();

  const [prompts, notes, paperTags, excerpts, edges, authors] = await Promise.all([
    supabase.from("note_prompts").select("id, key, title, guidance, ord").eq("is_active", true).order("ord").then(must),
    supabase.from("paper_notes").select("prompt_id, body").eq("paper_id", id).then(must),
    supabase.from("paper_tags").select("role, tags(id, name, kind)").eq("paper_id", id).then(must),
    supabase.from("excerpts").select("id, page, quote, comment").eq("paper_id", id).order("page", { nullsFirst: false }).then(must),
    supabase.rpc("paper_graph", { root: id, depth: 1 }).then(must),
    supabase.from("paper_authors").select("ord, authors(name)").eq("paper_id", id).order("ord").then(must),
  ]);

  const noteBy = new Map((notes ?? []).map((n) => [n.prompt_id, n.body]));

  type Edge = { source: string; target: string; rel: string };
  const edgeRows = (edges ?? []) as Edge[];

  // look up only the papers actually on screen, rather than the whole library
  const neighbourIds = [...new Set(edgeRows.flatMap((e) => [e.source, e.target]))]
    .filter((x) => x !== id);
  const neighbourPapers = neighbourIds.length
    ? must(await supabase.from("papers").select("id, title").in("id", neighbourIds))
    : [];
  const titleById = new Map((neighbourPapers ?? []).map((p) => [p.id, p.title]));

  // a link is mutual: which end recorded it is not shown, only who it connects to
  const neighbours = edgeRows.map((e) => {
    const otherId = e.source === id ? e.target : e.source;
    return {
      otherId,
      rel: e.rel,
      title: titleById.get(otherId) ?? "(unknown)",
      from: e.source,
      to: e.target,
    };
  });

  // deliberately not must(): a storage hiccup should hide the pdf button, not
  // block the notes, which are the reason the page exists
  const pdfUrl = paper.pdf_path
    ? (await supabase.storage.from("papers").createSignedUrl(paper.pdf_path, 3600)).data?.signedUrl
    : null;

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <section className="space-y-2">
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <EditableTitle id={id} initial={paper.title} action={updatePaper} />
          </div>
          <DeletePaper id={id} title={paper.title} action={deletePaper} className="pt-1"
                       redirectTo="/" />
        </div>
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

      <NotesEditor
        paperId={id}
        prompts={(prompts ?? []).map((p) => ({ id: p.id, ord: p.ord, title: p.title, guidance: p.guidance }))}
        initialNotes={Object.fromEntries((prompts ?? []).map((p) => [p.id, noteBy.get(p.id) ?? ""]))}
        initialSummary={paper.summary ?? ""}
        action={saveNotes}
      />

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
        <form action={addTag} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="paper_id" value={id} />
          <input className="field flex-1 min-w-64" name="name" required
                 placeholder="tag, another tag — comma separated" />
          <button className="btn">add</button>
        </form>

      </section>

      <section className="space-y-3">
        <h2 className="label">Graph</h2>
        {neighbours.length > 0 ? (
          <ul className="space-y-1 text-sm">
            {neighbours.map((n, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className={`chip ${n.rel === "cites" ? "" : "chip-cyan"}`}>
                  {n.rel}
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
        <form action={addEdge} className="space-y-2">
          <input type="hidden" name="paper_id" value={id} />
          <select className="field w-40" name="kind">
            {EDGE_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <PaperPicker name="to_ids" excludeId={id} search={findPapers} />
          <button className="btn">link</button>
        </form>

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
        <form action={addExcerpt} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="paper_id" value={id} />
          <input className="field w-16" name="page" placeholder="p." inputMode="numeric" />
          <input className="field flex-1 min-w-64" name="quote" placeholder="quote" required />
          <input className="field w-56" name="comment" placeholder="comment" />
          <button className="btn">add</button>
        </form>

      </section>

    </div>
  );
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export type SaveResult = { ok: boolean; message?: string };

/** Fields the generic paper editor is allowed to write. */
const EDITABLE = new Set([
  "title", "abstract", "year", "doi", "arxiv_id", "url", "bibtex",
  "cite_key", "status", "rating", "summary", "read_at", "is_stub", "pdf_path",
]);

function str(fd: FormData, k: string) {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

type Db = Awaited<ReturnType<typeof supabaseServer>>;

/** Split a comma-separated tag field into clean, de-duplicated names. */
function tagNames(raw: string): string[] {
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const name = part.trim().replace(/\s+/g, " ");
    if (name) seen.add(name);
  }
  return [...seen];
}

/**
 * Tags are unique per (owner, kind, name), so existing rows are reused.
 * Three round trips regardless of how many tags were typed: look up what
 * exists, insert what does not, then attach them all in one upsert.
 */
async function applyTags(db: Db, paper_id: string, names: string[], kind: string, role: string) {
  if (!names.length) return { ok: true };

  const { data: existing, error: lookupError } = await db
    .from("tags").select("id, name").eq("kind", kind).in("name", names);
  if (lookupError) return { ok: false, message: lookupError.message };

  const byName = new Map((existing ?? []).map((t) => [t.name, t.id as string]));
  const missing = names.filter((n) => !byName.has(n));

  if (missing.length) {
    const { data: created, error } = await db
      .from("tags").insert(missing.map((name) => ({ name, kind }))).select("id, name");
    if (error) return { ok: false, message: error.message };
    (created ?? []).forEach((t) => byName.set(t.name, t.id as string));
  }

  const { error } = await db.from("paper_tags").upsert(
    names.map((n) => ({ paper_id, tag_id: byName.get(n)!, role })),
  );
  return error ? { ok: false, message: error.message } : { ok: true };
}

/**
 * Both ends must already exist; the pickers only offer papers in the library.
 * Every target of one relation goes in a single upsert, so linking eight
 * references costs one write rather than eight.
 */
async function applyEdges(db: Db, from_id: string, to_ids: string[], kind: string) {
  const targets = [...new Set(to_ids)].filter((t) => t && t !== from_id);
  if (!targets.length) return { ok: true };

  const { error } =
    kind === "cites"
      ? await db.from("citations").upsert(
          targets.map((cited_id) => ({ citing_id: from_id, cited_id })))
      : await db.from("paper_links").upsert(
          targets.map((to_id) => ({ from_id, to_id, kind })));
  return error ? { ok: false, message: error.message } : { ok: true };
}

export async function createPaper(fd: FormData) {
  const supabase = await supabaseServer();
  const title = str(fd, "title");
  if (!title) return;

  const { data, error } = await supabase
    .from("papers")
    .insert({
      title,
      abstract: str(fd, "abstract"),
      year: str(fd, "year") ? Number(str(fd, "year")) : null,
      doi: str(fd, "doi"),
      arxiv_id: str(fd, "arxiv_id"),
      url: str(fd, "url"),
      cite_key: str(fd, "cite_key"),
      is_stub: fd.get("is_stub") === "on",
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  // an optional first tag and first connection, so filing needs no second trip
  const tagName = str(fd, "name");
  if (tagName) {
    await applyTags(supabase, data.id, tagNames(tagName), "topic", "about");
  }

  const toIds = fd.getAll("to_ids").filter((v): v is string => typeof v === "string");
  if (toIds.length) {
    await applyEdges(supabase, data.id, toIds, str(fd, "edge_kind") ?? "related");
  }

  redirect(`/papers/${data.id}`);
}

/**
 * Removes the paper and, by cascade, its notes, excerpts, tags, citations and
 * links. The stored PDF goes too — the row is the only reference to it, so
 * leaving the object behind would orphan it in the bucket for good.
 */
export async function deletePaper(fd: FormData) {
  const id = str(fd, "id");
  if (!id) return;

  const supabase = await supabaseServer();
  const { data: paper } = await supabase
    .from("papers").select("pdf_path").eq("id", id).maybeSingle();

  if (paper?.pdf_path) await supabase.storage.from("papers").remove([paper.pdf_path]);

  const { error } = await supabase.from("papers").delete().eq("id", id);
  if (error) throw new Error(error.message);

  // "layout" rather than the default: a deleted paper also changes the graph
  // and any other paper that linked to it, not just the library list.
  revalidatePath("/", "layout");

  // Only redirect when the page we came from no longer exists. Redirecting to
  // "/" from the library itself is a navigation to the page you are already on,
  // which the router treats as a no-op and serves from its cache, so the row
  // stays on screen.
  const to = str(fd, "redirectTo");
  if (to) redirect(to);
}

export async function updatePaper(fd: FormData): Promise<SaveResult> {
  const id = str(fd, "id");
  const field = str(fd, "field");
  if (!id || !field || !EDITABLE.has(field)) return { ok: false, message: "bad field" };

  const raw = fd.get("value");
  let value: string | number | boolean | null =
    typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null;
  if (field === "year" || field === "rating") value = value === null ? null : Number(value);
  if (field === "is_stub") value = raw === "on" || raw === "true";

  const supabase = await supabaseServer();
  const { error } = await supabase.from("papers").update({ [field]: value }).eq("id", id);
  if (error) return { ok: false, message: error.message };
  // only the pdf changes what gets rendered (signed URL + the open-pdf button)
  if (field === "pdf_path") revalidatePath(`/papers/${id}`);
  return { ok: true };
}

/**
 * One round trip for the whole writing surface: every changed answer plus the
 * summary. Called from a single coordinator on the client, so a typing session
 * produces one write per pause rather than one per field.
 */
export async function saveNotes(
  paperId: string,
  notes: { prompt_id: string; body: string }[],
  summary?: string | null,
): Promise<SaveResult> {
  const supabase = await supabaseServer();

  if (notes.length) {
    const { error } = await supabase.from("paper_notes").upsert(
      notes.map((n) => ({ paper_id: paperId, prompt_id: n.prompt_id, body: n.body })),
      { onConflict: "paper_id,prompt_id" },
    );
    if (error) return { ok: false, message: error.message };
  }

  if (summary !== undefined) {
    const { error } = await supabase
      .from("papers").update({ summary }).eq("id", paperId);
    if (error) return { ok: false, message: error.message };
  }

  // no revalidatePath: re-rendering costs ~9 reads and nothing on screen changes
  return { ok: true };
}

export async function addTag(fd: FormData) {
  const paper_id = str(fd, "paper_id");
  const name = str(fd, "name");
  if (!paper_id || !name) return;

  const supabase = await supabaseServer();
  await applyTags(supabase, paper_id, tagNames(name), "topic", "about");
  revalidatePath(`/papers/${paper_id}`);
}

export async function removeTag(fd: FormData) {
  const paper_id = str(fd, "paper_id");
  const tag_id = str(fd, "tag_id");
  const role = str(fd, "role");
  if (!paper_id || !tag_id || !role) return;

  const supabase = await supabaseServer();
  await supabase.from("paper_tags").delete().match({ paper_id, tag_id, role });
  revalidatePath(`/papers/${paper_id}`);
}

export async function addEdge(fd: FormData) {
  const from_id = str(fd, "paper_id");
  const kind = str(fd, "kind");
  const to_ids = fd.getAll("to_ids").filter((v): v is string => typeof v === "string");
  if (!from_id || !kind || !to_ids.length) return;

  const supabase = await supabaseServer();
  await applyEdges(supabase, from_id, to_ids, kind);
  revalidatePath(`/papers/${from_id}`);
}

/**
 * Backs the paper picker. Searching in the database rather than shipping the
 * whole library to the browser is what keeps this usable at a few thousand
 * papers; the trigram index on papers.title serves the ilike.
 */
export async function findPapers(q: string, excludeId?: string) {
  const supabase = await supabaseServer();
  const term = q.trim();

  let query = supabase.from("papers").select("id, title, year, is_stub").limit(20);
  query = term
    ? query.ilike("title", `%${term}%`).order("title")
    : query.order("created_at", { ascending: false });
  if (excludeId) query = query.neq("id", excludeId);

  const { data } = await query;
  return data ?? [];
}

export async function removeEdge(fd: FormData) {
  const from_id = str(fd, "from_id");
  const to_id = str(fd, "to_id");
  const kind = str(fd, "kind");
  if (!from_id || !to_id || !kind) return;

  const supabase = await supabaseServer();
  if (kind === "cites") {
    await supabase.from("citations").delete().match({ citing_id: from_id, cited_id: to_id });
  } else {
    await supabase.from("paper_links").delete().match({ from_id, to_id, kind });
  }
  revalidatePath(`/papers/${from_id}`);
}

export async function addExcerpt(fd: FormData) {
  const paper_id = str(fd, "paper_id");
  const quote = str(fd, "quote");
  if (!paper_id || !quote) return;

  const supabase = await supabaseServer();
  const page = str(fd, "page");
  const { error } = await supabase.from("excerpts").insert({
    paper_id, quote, page: page ? Number(page) : null, comment: str(fd, "comment"),
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/papers/${paper_id}`);
}

export async function deleteExcerpt(fd: FormData) {
  const id = str(fd, "id");
  const paper_id = str(fd, "paper_id");
  if (!id) return;
  const supabase = await supabaseServer();
  await supabase.from("excerpts").delete().eq("id", id);
  revalidatePath(`/papers/${paper_id}`);
}

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

/** Resolve the other paper by cite key, then exact title; optionally mint a stub. */
async function applyEdge(
  db: Db, from_id: string, target: string, kind: string,
  note: string | null, createStub: boolean,
) {
  const { data: byKey } = await db
    .from("papers").select("id").ilike("cite_key", target).maybeSingle();
  const byTitle = byKey ? null : (await db
    .from("papers").select("id").eq("title", target).limit(1).maybeSingle()).data;

  let to_id: string | null = byKey?.id ?? byTitle?.id ?? null;

  if (!to_id && createStub) {
    const { data, error } = await db
      .from("papers").insert({ title: target, is_stub: true }).select("id").single();
    if (error) return { ok: false, message: error.message };
    to_id = data.id;
  }
  if (!to_id || to_id === from_id) return { ok: true };

  const { error } =
    kind === "cites"
      ? await db.from("citations").upsert({ citing_id: from_id, cited_id: to_id, note })
      : await db.from("paper_links").upsert({ from_id, to_id, kind, note });
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
    await applyTags(supabase, data.id, tagNames(tagName), str(fd, "kind") ?? "topic", str(fd, "role") ?? "about");
  }

  const target = str(fd, "target");
  if (target) {
    await applyEdge(supabase, data.id, target, str(fd, "edge_kind") ?? "cites",
                    str(fd, "note"), fd.get("stub") === "on");
  }

  redirect(`/papers/${data.id}`);
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
  await applyTags(supabase, paper_id, tagNames(name), str(fd, "kind") ?? "topic", str(fd, "role") ?? "about");
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
  const target = str(fd, "target");
  const kind = str(fd, "kind");
  if (!from_id || !target || !kind) return;

  const supabase = await supabaseServer();
  await applyEdge(supabase, from_id, target, kind, str(fd, "note"), fd.get("stub") === "on");
  revalidatePath(`/papers/${from_id}`);
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

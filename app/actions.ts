"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

/** Fields the generic paper editor is allowed to write. */
const EDITABLE = new Set([
  "title", "abstract", "year", "doi", "arxiv_id", "url", "bibtex",
  "cite_key", "status", "rating", "summary", "read_at", "is_stub", "pdf_path",
]);

function str(fd: FormData, k: string) {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
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
  redirect(`/papers/${data.id}`);
}

export async function updatePaper(fd: FormData) {
  const id = str(fd, "id");
  const field = str(fd, "field");
  if (!id || !field || !EDITABLE.has(field)) return;

  const raw = fd.get("value");
  let value: string | number | boolean | null =
    typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null;
  if (field === "year" || field === "rating") value = value === null ? null : Number(value);
  if (field === "is_stub") value = raw === "on" || raw === "true";

  const supabase = await supabaseServer();
  const { error } = await supabase.from("papers").update({ [field]: value }).eq("id", id);
  if (error) throw new Error(error.message);
  // only the pdf changes what gets rendered (signed URL + the open-pdf button)
  if (field === "pdf_path") revalidatePath(`/papers/${id}`);
}

export async function saveNote(fd: FormData) {
  const paper_id = str(fd, "paper_id");
  const prompt_id = str(fd, "prompt_id");
  if (!paper_id || !prompt_id) return;

  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("paper_notes")
    .upsert({ paper_id, prompt_id, body: (fd.get("body") as string) ?? "" }, { onConflict: "paper_id,prompt_id" });
  if (error) throw new Error(error.message);
  // deliberately no revalidatePath: re-rendering this page costs ~9 reads, and
  // nothing on screen changes from saving the field you are typing in. The
  // answered/unanswered split and the N/8 count settle on the next load.
}

export async function addTag(fd: FormData) {
  const paper_id = str(fd, "paper_id");
  const name = str(fd, "name");
  const kind = str(fd, "kind") ?? "topic";
  const role = str(fd, "role") ?? "about";
  if (!paper_id || !name) return;

  const supabase = await supabaseServer();
  // tags are unique per (owner, kind, name); reuse the row if it already exists
  const { data: found } = await supabase
    .from("tags").select("id").eq("name", name).eq("kind", kind).maybeSingle();

  let tag_id = found?.id;
  if (!tag_id) {
    const { data, error } = await supabase.from("tags").insert({ name, kind }).select("id").single();
    if (error) throw new Error(error.message);
    tag_id = data.id;
  }

  const { error } = await supabase.from("paper_tags").upsert({ paper_id, tag_id, role });
  if (error) throw new Error(error.message);
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

/** Resolve the "other paper" in a link/citation form: exact cite key, else exact title. */
async function resolveTarget(target: string) {
  const supabase = await supabaseServer();
  const { data: byKey } = await supabase
    .from("papers").select("id").ilike("cite_key", target).maybeSingle();
  if (byKey) return byKey.id as string;
  const { data: byTitle } = await supabase
    .from("papers").select("id").eq("title", target).limit(1).maybeSingle();
  return (byTitle?.id as string) ?? null;
}

export async function addEdge(fd: FormData) {
  const from_id = str(fd, "paper_id");
  const target = str(fd, "target");
  const kind = str(fd, "kind");
  if (!from_id || !target || !kind) return;

  const supabase = await supabaseServer();
  let to_id = await resolveTarget(target);

  // Most references you cite are not in the library yet. Rather than leaving the
  // paper to create a stub and coming back, tick "new stub" and the typed text
  // becomes the title of one. Opt-in, so a typo cannot silently mint a paper.
  if (!to_id && fd.get("stub") === "on") {
    const { data, error } = await supabase
      .from("papers").insert({ title: target, is_stub: true }).select("id").single();
    if (error) throw new Error(error.message);
    to_id = data.id;
  }

  if (!to_id || to_id === from_id) return;

  const note = str(fd, "note");
  const { error } =
    kind === "cites"
      ? await supabase.from("citations").upsert({ citing_id: from_id, cited_id: to_id, note })
      : await supabase.from("paper_links").upsert({ from_id, to_id, kind, note });
  if (error) throw new Error(error.message);
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

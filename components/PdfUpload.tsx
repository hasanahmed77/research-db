"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

/** Uploads to <uid>/<paper_id>.pdf — the path shape the storage policy requires. */
export function PdfUpload({
  paperId, action,
}: {
  paperId: string;
  action: (fd: FormData) => Promise<void>;
}) {
  const [state, setState] = useState<"idle" | "busy" | string>("idle");

  async function upload(file: File) {
    setState("busy");
    const supabase = supabaseBrowser();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return setState("not signed in");

    const path = `${auth.user.id}/${paperId}.pdf`;
    const { error } = await supabase.storage
      .from("papers")
      .upload(path, file, { upsert: true, contentType: "application/pdf" });
    if (error) return setState(error.message);

    const fd = new FormData();
    fd.set("id", paperId);
    fd.set("field", "pdf_path");
    fd.set("value", path);
    await action(fd);
    setState("idle");
  }

  return (
    <label className="btn cursor-pointer">
      {state === "busy" ? "uploading…" : state === "idle" ? "upload pdf" : state}
      <input
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />
    </label>
  );
}

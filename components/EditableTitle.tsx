"use client";

import { useRef, useState } from "react";
import type { SaveResult } from "@/app/actions";

/** Reads as a heading; the pencil turns it into a field when you need one. */
export function EditableTitle({
  id, initial, action,
}: {
  id: string;
  initial: string;
  action: (fd: FormData) => Promise<SaveResult>;
}) {
  const [value, setValue] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [failed, setFailed] = useState(false);
  const saved = useRef(initial);

  const commit = async () => {
    setEditing(false);
    const next = value.trim();
    if (!next || next === saved.current) { setValue(saved.current); return; }

    const fd = new FormData();
    fd.set("id", id);
    fd.set("field", "title");
    fd.set("value", next);

    let res: SaveResult;
    try {
      res = await action(fd);
    } catch {
      res = { ok: false };
    }
    if (res.ok) { saved.current = next; setFailed(false); }
    else { setValue(saved.current); setFailed(true); }   // never claim a title that did not stick
  };

  if (editing) {
    return (
      <input
        className="field text-lg font-medium"
        autoFocus
        value={value}
        aria-label="paper title"
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); void commit(); }
          if (e.key === "Escape") { setValue(saved.current); setEditing(false); }
        }}
      />
    );
  }

  return (
    <div className="flex items-center gap-2">
      <h1 className="text-lg font-medium">{value}</h1>
      <button type="button" className="icon-quiet" title="Rename" aria-label="Rename this paper"
              onClick={() => setEditing(true)}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 20h4l10-10a2.1 2.1 0 0 0-3-3L5 17z" />
          <path d="M13.5 6.5l4 4" />
        </svg>
      </button>
      {failed && <span className="text-xs text-danger">not saved</span>}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import type { SaveResult } from "@/app/actions";

type Action = (fd: FormData) => Promise<SaveResult>;

/**
 * Wraps one field in its own form and submits it on blur (or on change, for a
 * select). Keeps every editor on the paper page independent — no page-wide
 * save button, no client state to keep in sync with the row.
 */
export function AutoSave({
  action, hidden, name, defaultValue, as = "input", rows = 3, placeholder, options, className, label,
}: {
  action: Action;
  hidden: Record<string, string>;
  name: string;
  defaultValue?: string;
  as?: "input" | "textarea" | "select";
  rows?: number;
  placeholder?: string;
  options?: string[];
  className?: string;
  /** inline caption shown before the control; also names it for screen readers */
  label?: string;
}) {
  const form = useRef<HTMLFormElement>(null);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 1500);
    return () => clearTimeout(t);
  }, [saved]);

  // warn if the tab closes with text that never reached the server
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty.current) e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  // call the action directly rather than requestSubmit(): fire-and-forget cannot
  // tell success from failure, which made "saved" a guess and dropped failed writes
  const commit = async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (!dirty.current || !form.current || inFlight.current) return;

    const fd = new FormData(form.current);
    inFlight.current = true;
    let res: SaveResult;
    try {
      res = await action(fd);
    } catch (e) {
      res = { ok: false, message: e instanceof Error ? e.message : "request failed" };
    }
    inFlight.current = false;

    if (res.ok) {
      dirty.current = false;   // only clean once the server accepted it
      setFailed(false);
      setSaved(true);
    } else {
      setFailed(true);         // stays dirty, so the next blur or pause retries
    }
  };

  // blur alone loses a long answer if the tab closes mid-sentence; save on a pause too
  const scheduleCommit = () => {
    dirty.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(commit, 2000);
  };

  const shared = {
    name,
    defaultValue,
    placeholder,
    "aria-label": label,
    className: className ?? "field",
    onChange: scheduleCommit,
    onBlur: commit,
  };

  return (
    <form ref={form}
          onSubmit={(e) => { e.preventDefault(); void commit(); }}
          className={label ? "relative flex items-center gap-1.5" : "relative"}>
      {label && <span className="text-sm text-muted">{label}</span>}
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {as === "textarea" && <textarea {...shared} rows={rows} />}
      {as === "input" && <input {...shared} />}
      {as === "select" && (
        <select {...shared} onChange={() => { dirty.current = true; commit(); }}>
          {options?.map((o) => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}
        </select>
      )}
      {(saved || failed) && (
        <span className={`pointer-events-none absolute right-2 top-1.5 text-xs ${
          failed ? "text-danger" : "text-muted"}`}>
          {failed ? "not saved" : "saved"}
        </span>
      )}
    </form>
  );
}

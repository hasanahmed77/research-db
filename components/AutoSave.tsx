"use client";

import { useEffect, useRef, useState } from "react";

type Action = (fd: FormData) => Promise<void>;

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
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 1500);
    return () => clearTimeout(t);
  }, [saved]);

  const commit = () => {
    if (!dirty.current) return;
    dirty.current = false;
    form.current?.requestSubmit();
    setSaved(true);
  };

  const shared = {
    name,
    defaultValue,
    placeholder,
    "aria-label": label,
    className: className ?? "field",
    onChange: () => { dirty.current = true; },
    onBlur: commit,
  };

  return (
    <form ref={form} action={action}
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
      {saved && (
        <span className="pointer-events-none absolute right-2 top-1.5 text-xs text-muted">
          saved
        </span>
      )}
    </form>
  );
}

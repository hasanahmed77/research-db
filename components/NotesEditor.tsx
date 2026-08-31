"use client";

import { useEffect, useRef, useState } from "react";
import type { SaveResult } from "@/app/actions";

type Prompt = { id: string; ord: number; title: string; guidance: string | null };
type SaveNotes = (
  paperId: string,
  notes: { prompt_id: string; body: string }[],
  summary?: string | null,
) => Promise<SaveResult>;

const SUMMARY = "__summary__";
const IDLE_MS = 1500;   // quiet period before a write
const MAX_MS = 10000;   // a continuous typist would never hit the idle window
const RETRY_MS = 4000;

/**
 * One save queue for the summary and all eight answers.
 *
 * Efficiency: a write only happens when something actually differs from what
 * the server last accepted, and one write carries every changed field, so a
 * writing session costs one round trip per pause rather than one per field.
 * Concurrent flushes are coalesced instead of racing.
 *
 * Honesty: "saved" is set from the server's answer, never optimistically, and
 * a field stays dirty until the write that carried it succeeds — so a failure
 * retries instead of being silently dropped.
 */
export function NotesEditor({
  paperId, prompts, initialNotes, initialSummary, action,
}: {
  paperId: string;
  prompts: Prompt[];
  initialNotes: Record<string, string>;
  initialSummary: string;
  action: SaveNotes;
}) {
  const initial: Record<string, string> = { ...initialNotes, [SUMMARY]: initialSummary };

  const [values, setValues] = useState<Record<string, string>>(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const saved = useRef<Record<string, string>>({ ...initial });
  const latest = useRef(values);
  latest.current = values;

  const inFlight = useRef(false);
  const rerun = useRef(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushRef = useRef<() => void>(() => {});

  const dirtyKeys = () =>
    Object.keys(latest.current).filter((k) => latest.current[k] !== saved.current[k]);

  const schedule = (delay: number = IDLE_MS) => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => flushRef.current(), delay);
    if (!maxTimer.current) maxTimer.current = setTimeout(() => flushRef.current(), MAX_MS);
  };

  const flush = async () => {
    if (idleTimer.current) { clearTimeout(idleTimer.current); idleTimer.current = null; }
    if (maxTimer.current) { clearTimeout(maxTimer.current); maxTimer.current = null; }

    // never two writes in the air at once; fold this one into the next
    if (inFlight.current) { rerun.current = true; return; }

    const keys = dirtyKeys();
    if (keys.length === 0) return; // nothing changed — no call at all

    const sent: Record<string, string> = {};
    keys.forEach((k) => { sent[k] = latest.current[k]; });

    const notes = keys.filter((k) => k !== SUMMARY).map((k) => ({ prompt_id: k, body: sent[k] }));
    const summary = SUMMARY in sent ? sent[SUMMARY] : undefined;

    inFlight.current = true;
    setStatus("saving");

    let res: SaveResult;
    try {
      res = await action(paperId, notes, summary);
    } catch (e) {
      res = { ok: false, message: e instanceof Error ? e.message : "request failed" };
    }
    inFlight.current = false;

    if (res.ok) {
      // only the snapshot that was sent becomes clean; edits made mid-flight stay dirty
      Object.assign(saved.current, sent);
      setStatus(dirtyKeys().length ? "idle" : "saved");
    } else {
      setStatus("error");
    }

    if (rerun.current || dirtyKeys().length) {
      rerun.current = false;
      schedule(res.ok ? 300 : RETRY_MS);
    }
  };
  flushRef.current = flush;

  useEffect(() => {
    if (status !== "saved") return;
    const t = setTimeout(() => setStatus("idle"), 1500);
    return () => clearTimeout(t);
  }, [status]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirtyKeys().length) e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
    // dirtyKeys reads refs only, so this never needs re-subscribing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (key: string, v: string) => {
    setValues((prev) => ({ ...prev, [key]: v }));
    latest.current = { ...latest.current, [key]: v };
    schedule();
  };

  const box = (key: string, rows: number, placeholder?: string) => (
    <textarea
      className="field"
      rows={rows}
      placeholder={placeholder}
      value={values[key] ?? ""}
      onChange={(e) => set(key, e.target.value)}
      onBlur={() => flushRef.current()}
    />
  );

  const answered = prompts.filter((p) => (values[p.id] ?? "").trim()).length;

  const badge = {
    idle: null,
    saving: <span className="text-muted">saving…</span>,
    saved: <span className="text-muted">saved</span>,
    error: <span className="text-danger">not saved — retrying</span>,
  }[status];

  return (
    <>
      <section className="space-y-2">
        <h2 className="label">Summary</h2>
        {box(SUMMARY, 3, "the paper in your own words")}
      </section>

      <section className="space-y-6">
        <h2 className="label flex items-center gap-3">
          Reading questions · {answered}/{prompts.length}
          <span className="text-[11px] normal-case tracking-normal">{badge}</span>
        </h2>

        {prompts.map((p) => {
          const answered = Boolean((values[p.id] ?? "").trim());
          return (
            <div key={p.id} className="space-y-2">
              <h3 className="font-display text-sm font-semibold tracking-wide">
                <span className={answered ? "text-accent" : "text-muted"}>
                  {String(p.ord).padStart(2, "0")}
                </span>{" "}
                {p.title}
              </h3>
              {p.guidance && <p className="text-xs leading-relaxed text-muted">{p.guidance}</p>}
              {box(p.id, 4)}
            </div>
          );
        })}
      </section>
    </>
  );
}

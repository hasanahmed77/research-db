"use client";

import { useEffect, useRef, useState } from "react";

type Hit = { id: string; title: string; year: number | null; is_stub: boolean };

/**
 * Shared by the create form and the paper page.
 *
 * Searches server-side and shows at most twenty hits, so the browser never
 * receives the whole library — the reason the old tick-list and <select> would
 * have collapsed as the library grew. Picks survive a change of search term,
 * because the chosen papers are held separately from the result list and
 * submitted as hidden inputs.
 */
export function PaperPicker({
  name, excludeId, search,
}: {
  name: string;
  excludeId?: string;
  search: (q: string, excludeId?: string) => Promise<Hit[]>;
}) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [chosen, setChosen] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const run = seq.current + 1;
    seq.current = run;
    setBusy(true);
    const t = setTimeout(async () => {
      const rows = await search(query, excludeId);
      if (seq.current === run) { setHits(rows); setBusy(false); } // ignore stale replies
    }, query ? 250 : 0);
    return () => clearTimeout(t);
  }, [query, excludeId, search]);

  const chosenIds = new Set(chosen.map((c) => c.id));
  const toggle = (h: Hit) =>
    setChosen((prev) => prev.some((c) => c.id === h.id)
      ? prev.filter((c) => c.id !== h.id)
      : [...prev, h]);

  return (
    <div className="space-y-2">
      {chosen.map((c) => <input key={c.id} type="hidden" name={name} value={c.id} />)}

      {chosen.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chosen.map((c) => (
            <span key={c.id} className="chip">
              {c.title}
              <button type="button" className="btn-sm" aria-label={`remove ${c.title}`}
                      onClick={() => toggle(c)}>×</button>
            </span>
          ))}
        </div>
      )}

      <input
        className="field"
        value={query}
        placeholder="search your library…"
        aria-label="search papers to link"
        onChange={(e) => setQuery(e.target.value)}
        // this sits inside a form; Enter should filter, not submit it
        onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
      />

      <ul className="max-h-56 divide-y divide-line overflow-y-auto border border-line bg-surface">
        {hits.map((h) => (
          <li key={h.id}>
            <label className="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-sm hover:text-accent">
              <input type="checkbox" checked={chosenIds.has(h.id)} onChange={() => toggle(h)} />
              <span className="flex-1">{h.title}</span>
              {h.year && <span className="text-xs text-muted">{h.year}</span>}
              {h.is_stub && <span className="chip">stub</span>}
            </label>
          </li>
        ))}
        {hits.length === 0 && (
          <li className="px-2 py-2 text-sm text-muted">
            {busy ? "searching…" : query ? "nothing matches" : "no papers yet"}
          </li>
        )}
      </ul>
    </div>
  );
}

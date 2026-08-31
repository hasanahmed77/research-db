"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export type TreeNodeData = { id: string; title: string; status: string; is_stub: boolean };
export type TreeEdge = { source: string; target: string; rel: string };

const REL_CLASS: Record<string, string> = {
  cites: "chip",
  related: "chip chip-cyan",
  contradicts: "chip",
};

const STATUS_COLOR: Record<string, string> = {
  read: "var(--accent)",
  reading: "var(--cyan)",
  to_read: "var(--muted)",
  archived: "var(--line)",
};

type Link_ = { id: string; rel: string; dir: "→" | "←" };

export function TreeGraph({
  papers, edges, initialRoot,
}: {
  papers: TreeNodeData[];
  edges: TreeEdge[];
  initialRoot: string | null;
}) {
  const byId = useMemo(() => new Map(papers.map((p) => [p.id, p])), [papers]);

  // undirected adjacency, keeping which way the relation was recorded
  const adj = useMemo(() => {
    const m = new Map<string, Link_[]>();
    const push = (k: string, v: Link_) => m.set(k, [...(m.get(k) ?? []), v]);
    for (const e of edges) {
      push(e.source, { id: e.target, rel: e.rel, dir: "→" });
      push(e.target, { id: e.source, rel: e.rel, dir: "←" });
    }
    for (const list of m.values()) list.sort((a, b) => a.rel.localeCompare(b.rel));
    return m;
  }, [edges]);

  const [root, setRoot] = useState<string | null>(initialRoot);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return papers
      .filter((p) => !q || p.title.toLowerCase().includes(q))
      .slice(0, 8);
  }, [papers, query]);

  const toggle = (path: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });

  function Branch({ id, ancestors, path, rel, dir }: {
    id: string; ancestors: string[]; path: string; rel?: string; dir?: "→" | "←";
  }) {
    const node = byId.get(id);
    if (!node) return null;

    // an ancestor reappearing is the graph showing through a tree; stop there
    const isCycle = ancestors.includes(id);
    const children = isCycle ? [] : (adj.get(id) ?? []);
    const expanded = open.has(path);

    return (
      <li>
        <div className="flex items-center gap-2 py-1">
          <button
            type="button"
            onClick={() => toggle(path)}
            disabled={children.length === 0}
            aria-label={expanded ? "collapse" : "expand"}
            className="w-4 shrink-0 text-left text-muted transition-colors hover:text-accent disabled:opacity-25"
          >
            {children.length === 0 ? "·" : expanded ? "▾" : "▸"}
          </button>

          {rel && <span className={REL_CLASS[rel] ?? "chip"}>{rel} {dir}</span>}

          <span className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ background: node.is_stub ? "transparent" : STATUS_COLOR[node.status],
                         boxShadow: `inset 0 0 0 1px ${STATUS_COLOR[node.status] ?? "var(--muted)"}` }} />

          <Link href={`/papers/${id}`} className="text-sm transition-colors hover:text-accent">
            {node.title}
          </Link>

          {node.is_stub && <span className="chip">stub</span>}
          {isCycle && (
            <span className="text-xs text-muted" title="this paper is already an ancestor here">
              above
            </span>
          )}
          {!expanded && children.length > 0 && (
            <span className="text-xs text-muted">{children.length}</span>
          )}
        </div>

        {expanded && children.length > 0 && (
          <ul className="tree ml-2">
            {children.map((c, i) => (
              <Branch key={`${c.id}-${c.rel}-${i}`}
                      id={c.id}
                      ancestors={[...ancestors, id]}
                      path={`${path}>${c.id}:${c.rel}:${i}`}
                      rel={c.rel}
                      dir={c.dir} />
            ))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <input className="field" value={query} placeholder="root the tree at…"
               aria-label="find a paper to root the tree at"
               onChange={(e) => setQuery(e.target.value)} />
        <div className="flex flex-wrap gap-1.5">
          {matches.map((p) => (
            <button key={p.id} type="button"
                    className={`btn text-xs ${p.id === root ? "border-accent text-accent" : ""}`}
                    onClick={() => { setRoot(p.id); setOpen(new Set(["r"])); }}>
              {p.title.length > 44 ? p.title.slice(0, 44) + "…" : p.title}
            </button>
          ))}
        </div>
      </div>

      {root ? (
        <ul className="list-none p-0">
          <Branch id={root} ancestors={[]} path="r" />
        </ul>
      ) : (
        <p className="text-sm text-muted">Pick a paper above to root the tree.</p>
      )}
    </div>
  );
}

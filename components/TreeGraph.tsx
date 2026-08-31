"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type TreeNodeData = { id: string; title: string; status: string; is_stub: boolean };
export type TreeEdge = { source: string; target: string; rel: string };

const REL_COLOR: Record<string, string> = {
  cites: "var(--muted)",
  related: "var(--cyan)",
  contradicts: "var(--danger)",
};

const STATUS_COLOR: Record<string, string> = {
  read: "var(--accent)",
  reading: "var(--cyan)",
  to_read: "var(--muted)",
  archived: "var(--line)",
};

const COL = 190;   // horizontal room per leaf — titles need it
const ROW = 104;   // vertical gap per level
const R = 15;
const PAD = 40;

type Link_ = { id: string; rel: string; dir: "→" | "←" };
type VNode = {
  key: string; id: string; rel?: string; dir?: string;
  isCycle: boolean; hidden: number; children: VNode[];
  x: number; y: number;
};

export function TreeGraph({
  papers, edges, initialRoot,
}: {
  papers: TreeNodeData[];
  edges: TreeEdge[];
  initialRoot: string | null;
}) {
  const router = useRouter();
  const byId = useMemo(() => new Map(papers.map((p) => [p.id, p])), [papers]);

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
  const [open, setOpen] = useState<Set<string>>(new Set(["r"]));

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return papers.filter((p) => !q || p.title.toLowerCase().includes(q)).slice(0, 8);
  }, [papers, query]);

  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  // Build only what is on screen, then lay it out: leaves take the next column,
  // parents centre over their children. Expansion stops at an ancestor so cycles
  // in the graph cannot make the tree infinite.
  const tree = useMemo(() => {
    if (!root || !byId.has(root)) return null;
    let column = 0;

    const build = (id: string, ancestors: string[], key: string,
                   rel?: string, dir?: string): VNode => {
      const isCycle = ancestors.includes(id);
      const links = isCycle ? [] : (adj.get(id) ?? []);
      const expanded = open.has(key);
      const children = expanded
        ? links.map((c, i) => build(c.id, [...ancestors, id], `${key}>${c.id}:${c.rel}:${i}`, c.rel, c.dir))
        : [];
      return { key, id, rel, dir, isCycle, hidden: expanded ? 0 : links.length, children, x: 0, y: 0 };
    };

    const place = (n: VNode, depth: number) => {
      n.y = PAD + depth * ROW;
      if (n.children.length === 0) {
        n.x = PAD + column * COL + COL / 2;
        column += 1;
      } else {
        n.children.forEach((c) => place(c, depth + 1));
        n.x = (n.children[0].x + n.children[n.children.length - 1].x) / 2;
      }
    };

    const r = build(root, [], "r");
    place(r, 0);

    const flat: VNode[] = [];
    const walk = (n: VNode) => { flat.push(n); n.children.forEach(walk); };
    walk(r);

    const width = Math.max(column * COL + PAD * 2, 640);
    const height = Math.max(...flat.map((n) => n.y)) + PAD + 34;
    return { root: r, flat, width, height };
  }, [root, adj, byId, open]);

  const clip = (t: string, n = 22) => (t.length > n ? t.slice(0, n) + "…" : t);

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
              {clip(p.title, 44)}
            </button>
          ))}
        </div>
      </div>

      {tree ? (
        <div className="overflow-x-auto border border-line bg-surface">
          <svg width={tree.width} height={tree.height} className="block">
            {tree.flat.flatMap((n) =>
              n.children.map((c) => {
                const mx = (n.x + c.x) / 2;
                const my = (n.y + c.y) / 2;
                return (
                  <g key={`e-${c.key}`}>
                    <line x1={n.x} y1={n.y + R} x2={c.x} y2={c.y - R}
                          stroke={REL_COLOR[c.rel ?? ""] ?? "var(--muted)"} strokeWidth={1.3} />
                    <text x={mx} y={my} textAnchor="middle" fontSize={9}
                          fill={REL_COLOR[c.rel ?? ""] ?? "var(--muted)"}
                          style={{ paintOrder: "stroke" }} stroke="var(--surface)" strokeWidth={3}>
                      {c.rel} {c.dir}
                    </text>
                  </g>
                );
              }))}

            {tree.flat.map((n) => {
              const p = byId.get(n.id);
              if (!p) return null;
              const color = STATUS_COLOR[p.status] ?? "var(--muted)";
              const openable = n.hidden > 0;
              return (
                <g key={n.key}>
                  <title>{p.title}</title>
                  <circle
                    cx={n.x} cy={n.y} r={R}
                    fill={p.is_stub ? "var(--bg)" : color}
                    fillOpacity={p.is_stub ? 1 : 0.22}
                    stroke={color} strokeWidth={1.8}
                    strokeDasharray={p.is_stub ? "3 2" : undefined}
                    style={{ cursor: openable || n.children.length ? "pointer" : "default" }}
                    onClick={() => (openable || n.children.length) && toggle(n.key)}
                  />
                  {openable && (
                    <text x={n.x} y={n.y + 3.5} textAnchor="middle" fontSize={10}
                          fill="var(--fg)" style={{ pointerEvents: "none" }}>
                      {n.hidden}
                    </text>
                  )}
                  <text
                    x={n.x} y={n.y + R + 14} textAnchor="middle" fontSize={11}
                    fill="var(--fg)" style={{ cursor: "pointer" }}
                    onClick={() => router.push(`/papers/${n.id}`)}
                  >
                    {clip(p.title)}
                  </text>
                  {n.isCycle && (
                    <text x={n.x} y={n.y + R + 26} textAnchor="middle" fontSize={9} fill="var(--muted)">
                      above
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      ) : (
        <p className="text-sm text-muted">Pick a paper above to root the tree.</p>
      )}

      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span>click a circle to expand · click a title to open the paper · the number is hidden children</span>
        <span className="ml-auto flex flex-wrap gap-x-3">
          <span style={{ color: "var(--muted)" }}>— cites</span>
          <span style={{ color: "var(--cyan)" }}>— related</span>
          <span style={{ color: "var(--danger)" }}>— contradicts</span>
          <span style={{ color: "var(--accent)" }}>● read</span>
          <span>◌ stub</span>
        </span>
      </p>
    </div>
  );
}

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
const LABEL_W = 160;  // side labels need horizontal room of their own

type Link_ = { id: string; rel: string; dir: "→" | "←" };
type VNode = {
  key: string; id: string; rel?: string; dir?: string;
  isCycle: boolean; hidden: number; children: VNode[];
  x: number; y: number; depth: number;
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
  // everything is open by default; this holds the exceptions
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return papers.filter((p) => !q || p.title.toLowerCase().includes(q)).slice(0, 8);
  }, [papers, query]);

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  /**
   * Breadth-first from the root, so every paper is drawn exactly once at its
   * shortest distance. The first edge that reaches a paper becomes its branch;
   * any further edge between two papers already on screen is drawn as a single
   * extra line between them rather than repeating the paper further down. That
   * is what keeps "A relates to B" from appearing as two separate nodes.
   */
  const graph = useMemo(() => {
    if (!root || !byId.has(root)) return null;

    const placed = new Map<string, VNode>();
    const rootNode: VNode = {
      key: root, id: root, isCycle: false, hidden: 0, children: [], x: 0, y: 0, depth: 0,
    };
    placed.set(root, rootNode);

    const queue: VNode[] = [rootNode];
    const seenEdge = new Set<string>();
    const cross: { a: string; b: string; rel: string }[] = [];

    while (queue.length) {
      const cur = queue.shift()!;
      if (collapsed.has(cur.id)) continue;

      for (const l of adj.get(cur.id) ?? []) {
        const key = [cur.id, l.id].sort().join("|") + "|" + l.rel;
        if (seenEdge.has(key)) continue;   // the pair is stored from both ends
        seenEdge.add(key);

        if (!placed.has(l.id)) {
          const child: VNode = {
            key: l.id, id: l.id, rel: l.rel, dir: l.dir, isCycle: false,
            hidden: 0, children: [], x: 0, y: 0, depth: cur.depth + 1,
          };
          placed.set(l.id, child);
          cur.children.push(child);
          queue.push(child);
        } else if (l.id !== cur.id) {
          cross.push({ a: cur.id, b: l.id, rel: l.rel });
        }
      }
    }

    for (const n of placed.values()) {
      if (collapsed.has(n.id)) n.hidden = (adj.get(n.id) ?? []).length;
    }

    let column = 0;
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
    place(rootNode, 0);

    // shift everything so the root sits on the vertical centre line, and make
    // the canvas symmetric about it so "centred" holds however lopsided the
    // branches are. Labels sit outside the nodes, so they need room too.
    const flat = [...placed.values()];
    const rootX = rootNode.x;
    const half =
      Math.max(rootX - Math.min(...flat.map((n) => n.x)),
               Math.max(...flat.map((n) => n.x)) - rootX) + LABEL_W;
    const width = Math.max(2 * half + PAD * 2, 560);
    const dx = width / 2 - rootX;
    flat.forEach((n) => { n.x += dx; });

    const height = Math.max(...flat.map((n) => n.y)) + PAD + 20;
    return { flat, cross, byNode: placed, width, height, centreX: width / 2 };
  }, [root, adj, byId, collapsed]);

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
                    onClick={() => { setRoot(p.id); setCollapsed(new Set()); }}>
              {clip(p.title, 44)}
            </button>
          ))}
        </div>
      </div>

      {graph ? (
        <div className="overflow-x-auto border border-line bg-surface">
          <svg width={graph.width} height={graph.height} className="mx-auto block">
            {graph.flat.flatMap((n) =>
              n.children.map((c) => {
                const mx = (n.x + c.x) / 2;
                const my = (n.y + c.y) / 2;
                return (
                  <g key={`e-${n.id}-${c.id}`}>
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

            {/* an edge between two papers already drawn: one line, no repeat node */}
            {graph.cross.map((e, i) => {
              const a = graph.byNode.get(e.a);
              const b = graph.byNode.get(e.b);
              if (!a || !b) return null;
              return (
                <line key={`x-${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                      stroke={REL_COLOR[e.rel] ?? "var(--muted)"} strokeWidth={1.1}
                      strokeDasharray="4 3" strokeOpacity={0.7} />
              );
            })}

            {graph.flat.map((n) => {
              const p = byId.get(n.id);
              if (!p) return null;
              const color = STATUS_COLOR[p.status] ?? "var(--muted)";
              const hasKids = n.children.length > 0 || n.hidden > 0;
              return (
                <g key={n.id}>
                  <title>{p.title}</title>
                  <circle
                    cx={n.x} cy={n.y} r={R}
                    fill={p.is_stub ? "var(--bg)" : color}
                    fillOpacity={p.is_stub ? 1 : 0.22}
                    stroke={color} strokeWidth={1.8}
                    strokeDasharray={p.is_stub ? "3 2" : undefined}
                    style={{ cursor: hasKids ? "pointer" : "default" }}
                    onClick={() => hasKids && toggle(n.id)}
                  />
                  {n.hidden > 0 && (
                    <text x={n.x} y={n.y + 3.5} textAnchor="middle" fontSize={10}
                          fill="var(--fg)" style={{ pointerEvents: "none" }}>
                      {n.hidden}
                    </text>
                  )}
                  {(() => {
                    const side = n.x - graph.centreX;
                    const isRoot = n.depth === 0;
                    // root above, left branch to the left, right branch to the
                    // right — labels lean away from the drawing, never over it
                    const anchor = isRoot || Math.abs(side) < 1
                      ? "middle" : side < 0 ? "end" : "start";
                    const tx = anchor === "middle" ? n.x : side < 0 ? n.x - R - 7 : n.x + R + 7;
                    const ty = isRoot ? n.y - R - 9
                      : anchor === "middle" ? n.y + R + 15 : n.y + 4;
                    return (
                      <text x={tx} y={ty} textAnchor={anchor} fontSize={11}
                            fill="var(--fg)" style={{ cursor: "pointer" }}
                            onClick={() => router.push(`/papers/${n.id}`)}>
                        {clip(p.title)}
                      </text>
                    );
                  })()}
                </g>
              );
            })}
          </svg>
        </div>
      ) : (
        <p className="text-sm text-muted">Pick a paper above to root the tree.</p>
      )}

      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span>click a circle to collapse it · click a title to open the paper · a dashed line is a further connection between two papers already shown</span>
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

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

const COL = 190;
const ROW = 104;
const R = 15;
const PAD = 40;
const LABEL_W = 160;

type Link_ = { id: string; rel: string; dir: "→" | "←" };
type VNode = {
  id: string; rel?: string; dir?: string;
  children: VNode[];
  x: number; y: number; anchorX: number;   // anchorX decides which side the label sits
};

export function TreeGraph({
  papers, edges,
}: {
  papers: TreeNodeData[];
  edges: TreeEdge[];
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

  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState<string | null>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return papers.filter((p) => p.title.toLowerCase().includes(q)).slice(0, 8);
  }, [papers, query]);

  /**
   * Every paper is drawn, exactly once. Linked papers form clusters laid out in
   * rows by distance from the best-connected paper in that cluster; clusters sit
   * side by side. A paper with no links is simply a cluster of one, parked in a
   * grid below — no root has to be invented for it to belong to.
   */
  const graph = useMemo(() => {
    const degree = (id: string) => (adj.get(id) ?? []).length;
    const placed = new Map<string, VNode>();
    const roots: VNode[] = [];
    const cross: { a: string; b: string; rel: string }[] = [];
    const seenEdge = new Set<string>();
    let column = 0;

    const linked = papers.filter((p) => degree(p.id) > 0)
      .sort((a, b) => degree(b.id) - degree(a.id));

    for (const p of linked) {
      if (placed.has(p.id)) continue;

      const rootNode: VNode = { id: p.id, children: [], x: 0, y: 0, anchorX: 0 };
      placed.set(p.id, rootNode);
      const queue = [rootNode];

      while (queue.length) {
        const cur = queue.shift()!;
        for (const l of adj.get(cur.id) ?? []) {
          const key = [cur.id, l.id].sort().join("|") + "|" + l.rel;
          if (seenEdge.has(key)) continue;
          seenEdge.add(key);
          if (!placed.has(l.id)) {
            const child: VNode = {
              id: l.id, rel: l.rel, dir: l.dir, children: [], x: 0, y: 0, anchorX: 0,
            };
            placed.set(l.id, child);
            cur.children.push(child);
            queue.push(child);
          } else if (l.id !== cur.id) {
            cross.push({ a: cur.id, b: l.id, rel: l.rel });
          }
        }
      }

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
      column += 1;                       // a gap before the next cluster
      roots.push(rootNode);
    }

    // labels lean away from the middle of their own cluster
    const applyAnchor = (root: VNode) => {
      const walk = (n: VNode, cx: number) => {
        n.anchorX = cx;
        n.children.forEach((c) => walk(c, cx));
      };
      walk(root, root.x);
    };
    roots.forEach(applyAnchor);

    const clusterBottom = placed.size
      ? Math.max(...[...placed.values()].map((n) => n.y))
      : PAD;

    // unlinked papers, packed under the clusters
    const loners = papers.filter((p) => degree(p.id) === 0);
    const perRow = Math.max(3, Math.min(6, Math.ceil(Math.sqrt(loners.length))));
    const lonerTop = clusterBottom + (loners.length ? ROW : 0);
    loners.forEach((p, i) => {
      const n: VNode = {
        id: p.id, children: [], x: PAD + (i % perRow) * COL + COL / 2,
        y: lonerTop + Math.floor(i / perRow) * 78, anchorX: 0,
      };
      n.anchorX = n.x;                   // no cluster to lean away from: label underneath
      placed.set(p.id, n);
    });

    const flat = [...placed.values()];
    if (!flat.length) return null;

    const width = Math.max(
      Math.max(...flat.map((n) => n.x)) + LABEL_W + PAD,
      column * COL + PAD * 2,
      560,
    );
    const height = Math.max(...flat.map((n) => n.y)) + PAD + 24;
    return { flat, roots, cross, byNode: placed, width, height, loners: loners.length, lonerTop };
  }, [papers, adj]);

  const clip = (t: string, n = 22) => (t.length > n ? t.slice(0, n) + "…" : t);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <input className="field" value={query} placeholder="find a paper…"
               aria-label="find a paper in the graph"
               onChange={(e) => setQuery(e.target.value)} />
        {matches.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {matches.map((p) => (
              <button key={p.id} type="button"
                      className={`btn text-xs ${p.id === focus ? "border-accent text-accent" : ""}`}
                      onClick={() => setFocus(p.id === focus ? null : p.id)}>
                {clip(p.title, 44)}
              </button>
            ))}
          </div>
        )}
      </div>

      {graph ? (
        <div className="overflow-x-auto border border-line bg-surface">
          <svg width={graph.width} height={graph.height} className="mx-auto block">
            {graph.loners > 0 && (
              <>
                <line x1={PAD} y1={graph.lonerTop - ROW / 2} x2={graph.width - PAD}
                      y2={graph.lonerTop - ROW / 2}
                      stroke="var(--line)" strokeDasharray="2 4" />
                <text x={PAD} y={graph.lonerTop - ROW / 2 - 8} fontSize={10} fill="var(--muted)">
                  not linked to anything yet
                </text>
              </>
            )}

            {/* the colour carries the relation; the legend explains it */}
            {graph.flat.flatMap((n) =>
              n.children.map((c) => (
                <line key={`e-${n.id}-${c.id}`}
                      x1={n.x} y1={n.y + R} x2={c.x} y2={c.y - R}
                      stroke={REL_COLOR[c.rel ?? ""] ?? "var(--muted)"} strokeWidth={1.3} />
              )))}

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
              const lit = focus === n.id;
              const open = () => router.push(`/papers/${n.id}`);
              const side = n.x - n.anchorX;
              const anchor = Math.abs(side) < 1 ? "middle" : side < 0 ? "end" : "start";
              const tx = anchor === "middle" ? n.x : side < 0 ? n.x - R - 7 : n.x + R + 7;
              // a cluster root would otherwise sit its label on top of its own edges
              const ty = anchor !== "middle" ? n.y + 4
                : n.children.length > 0 ? n.y - R - 9
                : n.y + R + 15;
              return (
                <g key={n.id}>
                  <title>{p.title}</title>
                  {lit && <circle cx={n.x} cy={n.y} r={R + 5} fill="none"
                                  stroke="var(--accent)" strokeWidth={1.4} />}
                  <circle
                    cx={n.x} cy={n.y} r={R}
                    fill={p.is_stub ? "var(--bg)" : color}
                    fillOpacity={p.is_stub ? 1 : 0.22}
                    stroke={color} strokeWidth={1.8}
                    strokeDasharray={p.is_stub ? "3 2" : undefined}
                    style={{ cursor: "pointer" }}
                    onClick={open}
                  />
                  <text x={tx} y={ty} textAnchor={anchor} fontSize={11}
                        fill={lit ? "var(--accent)" : "var(--fg)"} style={{ cursor: "pointer" }}
                        onClick={open}>
                    {clip(p.title)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      ) : (
        <p className="text-sm text-muted">No papers yet.</p>
      )}

      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span>click a paper to open it · dashed lines are further connections between papers already drawn</span>
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

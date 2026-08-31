"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

type Link_ = { id: string; rel: string };
type VNode = {
  id: string; rel?: string;
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
      push(e.source, { id: e.target, rel: e.rel });
      push(e.target, { id: e.source, rel: e.rel });
    }
    for (const list of m.values()) list.sort((a, b) => a.rel.localeCompare(b.rel));
    return m;
  }, [edges]);

  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState<string | null>(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });

  const svgRef = useRef<SVGSVGElement>(null);
  // sx/sy is where the press started, lx/ly the last position seen
  const drag = useRef<
    { sx: number; sy: number; lx: number; ly: number; id: number; panning: boolean } | null
  >(null);
  // a drag that ends over a node must not also open it
  const moved = useRef(false);

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
              id: l.id, rel: l.rel, children: [], x: 0, y: 0, anchorX: 0,
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

    // The true ink extent, labels included — centring the canvas box instead
    // left the drawing off to one side, because the box carries label slack on
    // the right that the left never uses.
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of flat) {
      const side = n.x - n.anchorX;
      const middle = Math.abs(side) < 1;
      const left = middle ? LABEL_W / 2 : side < 0 ? LABEL_W : R;
      const right = middle ? LABEL_W / 2 : side > 0 ? LABEL_W : R;
      const up = R + (middle && n.children.length > 0 ? 22 : 0);
      const down = R + (middle && n.children.length === 0 ? 22 : 0);
      minX = Math.min(minX, n.x - left);
      maxX = Math.max(maxX, n.x + right);
      minY = Math.min(minY, n.y - up);
      maxY = Math.max(maxY, n.y + down);
    }
    if (loners.length) minY = Math.min(minY, lonerTop - ROW / 2 - 20);

    return {
      flat, roots, cross, byNode: placed, loners: loners.length, lonerTop,
      bounds: { minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY },
    };
  }, [papers, adj]);

  const clip = (t: string, n = 22) => (t.length > n ? t.slice(0, n) + "…" : t);

  /** Scale the drawing to the pane and centre it on its own ink, not on the canvas. */
  const fit = useCallback(() => {
    const el = svgRef.current;
    if (!el || !graph) return;
    const { width: vw, height: vh } = el.getBoundingClientRect();
    if (!vw || !vh) return;
    const { minX, minY, w, h } = graph.bounds;
    const margin = 24;
    const k = Math.min(1, (vw - margin * 2) / w, (vh - margin * 2) / h);
    setView({
      k,
      x: (vw - w * k) / 2 - minX * k,
      y: (vh - h * k) / 2 - minY * k,
    });
  }, [graph]);

  useEffect(() => { fit(); }, [fit]);

  // wheel has to be a native non-passive listener, or preventDefault is ignored
  // and the page scrolls behind the zoom
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      setView((v) => {
        const k = Math.min(4, Math.max(0.2, v.k * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
        const s = k / v.k;                       // keep the point under the cursor still
        return { k, x: px - (px - v.x) * s, y: py - (py - v.y) * s };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const zoomBy = (factor: number) =>
    setView((v) => {
      const el = svgRef.current;
      const rect = el?.getBoundingClientRect();
      const px = (rect?.width ?? 0) / 2;
      const py = (rect?.height ?? 0) / 2;
      const k = Math.min(4, Math.max(0.2, v.k * factor));
      const s = k / v.k;
      return { k, x: px - (px - v.x) * s, y: py - (py - v.y) * s };
    });

  /** A line between two papers, trimmed so it meets the circles rather than covering them. */
  const segment = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.hypot(dx, dy) || 1;
    return {
      x1: a.x + (dx / d) * R, y1: a.y + (dy / d) * R,
      x2: b.x - (dx / d) * R, y2: b.y - (dy / d) * R,
    };
  };

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
        <div className="glass relative h-[calc(100vh-19rem)] min-h-96 overflow-hidden">
          <div className="absolute right-2 top-2 z-10 flex gap-1">
            <button type="button" className="btn-sm" onClick={() => zoomBy(1.2)} aria-label="zoom in">+</button>
            <button type="button" className="btn-sm" onClick={() => zoomBy(1 / 1.2)} aria-label="zoom out">−</button>
            <button type="button" className="btn-sm" onClick={fit}>fit</button>
          </div>
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            className="block h-full w-full touch-none"
            style={{ cursor: "grab" }}
            onPointerDown={(e) => {
              drag.current = {
                sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY,
                id: e.pointerId, panning: false,
              };
              moved.current = false;
            }}
            onPointerMove={(e) => {
              const d = drag.current;
              if (!d) return;
              const dx = e.clientX - d.lx;
              const dy = e.clientY - d.ly;
              d.lx = e.clientX;
              d.ly = e.clientY;

              // Capture only once this is really a drag. Capturing on pointerdown
              // retargets every later event — click included — to the <svg>, so a
              // plain click never reached the circle underneath.
              if (!d.panning && Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 4) {
                d.panning = true;
                moved.current = true;
                e.currentTarget.setPointerCapture(d.id);
              }
              if (d.panning) setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
            }}
            onPointerUp={(e) => {
              if (drag.current?.panning) e.currentTarget.releasePointerCapture(drag.current.id);
              drag.current = null;
            }}
          >
          <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
            {/* undirected: a link means the two papers are connected, either way */}
            {graph.flat.flatMap((n) =>
              n.children.map((c) => (
                <line key={`e-${n.id}-${c.id}`} {...segment(n, c)}
                      stroke={REL_COLOR[c.rel ?? ""] ?? "var(--muted)"} strokeWidth={1.3} />
              )))}

            {graph.cross.map((e, i) => {
              const a = graph.byNode.get(e.a);
              const b = graph.byNode.get(e.b);
              if (!a || !b) return null;
              return (
                <line key={`x-${i}`} {...segment(a, b)}
                      stroke={REL_COLOR[e.rel] ?? "var(--muted)"} strokeWidth={1.1}
                      strokeDasharray="4 3" strokeOpacity={0.7} />
              );
            })}

            {graph.flat.map((n) => {
              const p = byId.get(n.id);
              if (!p) return null;
              const color = STATUS_COLOR[p.status] ?? "var(--muted)";
              const lit = focus === n.id;
              const open = () => { if (!moved.current) router.push(`/papers/${n.id}`); };
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
          </g>
          </svg>
        </div>
      ) : (
        <p className="text-sm text-muted">No papers yet.</p>
      )}

      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span>drag to move · scroll to zoom · click a paper to open it · dashed lines are further connections</span>
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

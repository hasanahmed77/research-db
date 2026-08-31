import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { TreeGraph, type TreeEdge, type TreeNodeData } from "@/components/TreeGraph";

export default async function GraphPage() {
  const supabase = await supabaseServer();

  // the adjacency has to be complete for expansion to be instant; both sets are
  // small enough at personal-library scale that fetching them beats a round
  // trip per expand
  const [{ data: papers }, { data: edges }] = await Promise.all([
    supabase.from("papers").select("id, title, status, is_stub")
      .order("created_at", { ascending: false }).limit(1000),
    supabase.from("paper_edges").select("source, target, rel").limit(4000),
  ]);

  const nodes = (papers ?? []) as TreeNodeData[];
  const links = (edges ?? []) as TreeEdge[];

  return (
    <div className="flex flex-1 flex-col gap-4">
      <h1 className="label">Graph · {nodes.length} papers · {links.length} links</h1>
      {nodes.length === 0 ? (
        <p className="text-sm text-muted">
          Nothing to draw yet. <Link href="/papers/new" className="underline">Add a paper</Link>.
        </p>
      ) : (
        <TreeGraph papers={nodes} edges={links} />
      )}
    </div>
  );
}

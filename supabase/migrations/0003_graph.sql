-- graph traversal helpers for the visualiser

-- every edge in the library, in one shape
create view paper_edges with (security_invoker = on) as
  select citing_id as source, cited_id as target, 'cites'::text as rel, note from citations
  union all
  select from_id, to_id, kind::text, note from paper_links;

-- edges within `depth` hops of a paper, ignoring direction while walking.
-- feed straight into d3 / cytoscape / react-flow.
create or replace function paper_graph(root uuid, depth int default 1)
returns table (source uuid, target uuid, rel text)
language sql stable
as $$
  with recursive nodes as (
    select root as id, 0 as hop
    union
    select case when e.source = n.id then e.target else e.source end, n.hop + 1
    from nodes n
    join paper_edges e on e.source = n.id or e.target = n.id
    where n.hop < depth
  )
  select e.source, e.target, e.rel
  from paper_edges e
  where e.source in (select id from nodes)
    and e.target in (select id from nodes);
$$;

-- papers that share the most references with this one (co-citation strength).
-- the cheapest useful "what else should I read" signal.
create or replace function related_by_citation(root uuid, max_results int default 20)
returns table (id uuid, shared int)
language sql stable
as $$
  select c2.citing_id, count(*)::int as shared
  from citations c1
  join citations c2 on c2.cited_id = c1.cited_id and c2.citing_id <> root
  where c1.citing_id = root
  group by c2.citing_id
  order by shared desc
  limit max_results;
$$;

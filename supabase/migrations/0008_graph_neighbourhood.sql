-- paper_graph returned every edge whose two endpoints happened to be visited,
-- so an edge between two neighbours of the root showed up in the root's
-- neighbourhood despite not touching it. Keep only edges actually traversed:
-- one endpoint must sit strictly inside the depth horizon.
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
  ),
  reached as (select id, min(hop) as hop from nodes group by id)
  select distinct e.source, e.target, e.rel
  from paper_edges e
  join reached s on s.id = e.source
  join reached t on t.id = e.target
  where least(s.hop, t.hop) < depth;
$$;

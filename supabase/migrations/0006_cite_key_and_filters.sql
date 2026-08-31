-- citation key, for mapping \cite{liu2020energy} back to a library row
alter table papers add column cite_key text;
create unique index papers_cite_key on papers (owner_id, lower(cite_key)) where cite_key is not null;

create or replace view paper_cards with (security_invoker = on) as
select p.id, p.title, p.year, p.status, p.rating, p.summary, p.pdf_path, p.url,
       p.is_stub, p.read_at, p.created_at,
       v.short_name as venue,
       coalesce(a.names, '{}') as authors,
       coalesce(g.names, '{}') as tags,
       coalesce(n.filled, 0)   as notes_filled,
       (select count(*) from note_prompts np
         where np.is_active and (np.owner_id is null or np.owner_id = p.owner_id)) as notes_total,
       (select count(*) from citations c where c.citing_id = p.id) as cites_out,
       (select count(*) from citations c where c.cited_id  = p.id) as cited_by,
       p.cite_key
from papers p
left join venues v on v.id = p.venue_id
left join lateral (select array_agg(au.name order by pa.ord) as names
                   from paper_authors pa join authors au on au.id = pa.author_id
                   where pa.paper_id = p.id) a on true
left join lateral (select array_agg(t.name order by t.name) as names
                   from paper_tags pt join tags t on t.id = pt.tag_id
                   where pt.paper_id = p.id) g on true
left join lateral (select count(*) as filled from paper_notes pn
                   where pn.paper_id = p.id and length(btrim(pn.body)) > 0) n on true;

-- filters move inside the query so they apply before the rank cut, not after.
-- dropped rather than replaced: the argument list changed, so CREATE OR REPLACE
-- would leave an ambiguous two-argument overload behind.
drop function if exists search_papers(text, int);

create or replace function search_papers(
  q             text,
  max_results   int          default 50,
  filter_status paper_status default null,
  year_from     int          default null,
  year_to       int          default null,
  tag_ids       uuid[]       default null,
  include_stubs boolean      default true
)
returns table (id uuid, rank real, snippet text)
language sql stable
as $$
  with parsed as (
    select tq_and,
           case when position('!' in tq_and::text) > 0 then tq_and
                else replace(tq_and::text, '&', '|')::tsquery end as tq_or,
           array(select t from unnest(regexp_split_to_array(lower(btrim(q)), '\s+')) t
                 where length(t) >= 3) as terms
    from (select websearch_to_tsquery('english', q) as tq_and) _
  )
  select p.id,
         (greatest(
            -- an exact cite key is an identifier lookup, not a text match: rank it top
            case when lower(p.cite_key) = lower(btrim(q)) then 1.0 else 0 end,
            ts_rank(p.fts, x.tq_or),
            coalesce((select max(ts_rank(n.fts, x.tq_or)) from paper_notes n where n.paper_id = p.id), 0) * 0.7,
            coalesce((select max(ts_rank(e.fts, x.tq_or)) from excerpts    e where e.paper_id = p.id), 0) * 0.6,
            similarity(p.title, q) * 0.6,
            case when exists (select 1 from paper_authors pa join authors a on a.id = pa.author_id,
                                          unnest(x.terms) term
                              where pa.paper_id = p.id and a.name ilike '%'||term||'%') then 0.5 else 0 end,
            case when exists (select 1 from paper_tags pt join tags g on g.id = pt.tag_id,
                                          unnest(x.terms) term
                              where pt.paper_id = p.id and g.name ilike '%'||term||'%') then 0.45 else 0 end
          ) * case when p.fts @@ x.tq_and then 2.0 else 1.0 end)::real as rank,
         ts_headline('english', coalesce(nullif(p.summary,''), p.abstract, ''), x.tq_or,
                     'MaxFragments=2,MinWords=8,MaxWords=22,StartSel=<mark>,StopSel=</mark>') as snippet
  from papers p, parsed x
  where (
        p.fts @@ x.tq_or
     or p.title % q
     or lower(p.cite_key) = lower(btrim(q))
     or exists (select 1 from paper_notes n where n.paper_id = p.id and n.fts @@ x.tq_or)
     or exists (select 1 from excerpts    e where e.paper_id = p.id and e.fts @@ x.tq_or)
     or exists (select 1 from paper_authors pa join authors a on a.id = pa.author_id, unnest(x.terms) term
                where pa.paper_id = p.id and a.name ilike '%'||term||'%')
     or exists (select 1 from paper_tags pt join tags g on g.id = pt.tag_id, unnest(x.terms) term
                where pt.paper_id = p.id and g.name ilike '%'||term||'%')
  )
    and (filter_status is null or p.status = filter_status)
    and (year_from     is null or p.year >= year_from)
    and (year_to       is null or p.year <= year_to)
    and (include_stubs or not p.is_stub)
    and (tag_ids is null or exists (select 1 from paper_tags pt
                                    where pt.paper_id = p.id and pt.tag_id = any (tag_ids)))
  order by rank desc, p.year desc nulls last
  limit max_results;
$$;

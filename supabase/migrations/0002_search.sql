-- full-text + fuzzy search over papers and your own notes

alter table papers add column fts tsvector generated always as (
  setweight(to_tsvector('english', coalesce(title,    '')), 'A') ||
  setweight(to_tsvector('english', coalesce(summary,  '')), 'B') ||
  setweight(to_tsvector('english', coalesce(abstract, '')), 'C')
) stored;
create index papers_fts_idx on papers using gin (fts);

alter table paper_notes add column fts tsvector generated always as (
  to_tsvector('english', coalesce(body, ''))
) stored;
create index paper_notes_fts_idx on paper_notes using gin (fts);

alter table excerpts add column fts tsvector generated always as (
  to_tsvector('english', coalesce(quote,'') || ' ' || coalesce(comment,''))
) stored;
create index excerpts_fts_idx on excerpts using gin (fts);

-- one entry point for the app: matches title/abstract/summary, notes, excerpts,
-- author names and tag names, plus trigram fallback for typo'd titles.
-- terms are OR'd for recall; a row matching every term is ranked twice as high.
-- RLS applies (security invoker), so it only ever returns your own rows.
create or replace function search_papers(q text, max_results int default 50)
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
  where p.fts @@ x.tq_or
     or p.title % q
     or exists (select 1 from paper_notes n where n.paper_id = p.id and n.fts @@ x.tq_or)
     or exists (select 1 from excerpts    e where e.paper_id = p.id and e.fts @@ x.tq_or)
     or exists (select 1 from paper_authors pa join authors a on a.id = pa.author_id, unnest(x.terms) term
                where pa.paper_id = p.id and a.name ilike '%'||term||'%')
     or exists (select 1 from paper_tags pt join tags g on g.id = pt.tag_id, unnest(x.terms) term
                where pt.paper_id = p.id and g.name ilike '%'||term||'%')
  order by rank desc, p.year desc nulls last
  limit max_results;
$$;

-- denormalised row for list/grid views: one round trip, no N+1
create view paper_cards with (security_invoker = on) as
select p.id, p.title, p.year, p.status, p.rating, p.summary, p.pdf_path, p.url,
       p.is_stub, p.read_at, p.created_at,
       v.short_name as venue,
       coalesce(a.names, '{}') as authors,
       coalesce(g.names, '{}') as tags,
       coalesce(n.filled, 0)   as notes_filled,
       (select count(*) from note_prompts np
         where np.is_active and (np.owner_id is null or np.owner_id = p.owner_id)) as notes_total,
       (select count(*) from citations c where c.citing_id = p.id) as cites_out,
       (select count(*) from citations c where c.cited_id  = p.id) as cited_by
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

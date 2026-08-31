-- research-db: core schema
create extension if not exists pg_trgm;

create type paper_status as enum ('to_read','reading','read','archived');
create type venue_kind   as enum ('conference','journal','workshop','preprint','thesis','book','other');
create type tag_kind     as enum ('topic','method','dataset','task','metric','application');
create type tag_role     as enum ('about','introduces','uses','evaluates_on','improves','compares_against');
create type link_type    as enum ('extends','contradicts','reproduces','applies','alternative_to','surveys','prerequisite_for','related');

-- ---------- nodes ----------

create table venues (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users on delete cascade,
  name        text not null,
  short_name  text,
  kind        venue_kind not null default 'conference',
  unique (owner_id, name)
);

create table authors (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users on delete cascade,
  name        text not null,
  orcid       text,
  affiliation text,
  unique (owner_id, name)
);
create index authors_name_trgm on authors using gin (name gin_trgm_ops);

-- tags double as the concept graph: topics, methods, datasets, tasks, metrics.
-- parent_id makes them hierarchical (e.g. "OOD detection" under "robustness").
create table tags (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users on delete cascade,
  name        text not null,
  kind        tag_kind not null default 'topic',
  parent_id   uuid references tags on delete set null,
  description text,
  unique (owner_id, kind, name)
);
create index tags_parent_idx on tags (parent_id);
create index tags_name_trgm  on tags using gin (name gin_trgm_ops);

create table papers (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users on delete cascade,
  title       text not null,
  abstract    text,
  year        smallint,
  venue_id    uuid references venues on delete set null,
  doi         text,
  arxiv_id    text,
  url         text,
  pdf_path    text,                       -- object path in the 'papers' storage bucket
  bibtex      text,
  -- a stub is a paper you only know as a reference (no PDF, not read yet).
  -- it keeps the citation graph complete without polluting the reading list.
  is_stub     boolean not null default false,
  status      paper_status not null default 'to_read',
  rating      smallint check (rating between 1 and 5),
  summary     text,                        -- the paper in your own words
  read_at     date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index papers_doi_key   on papers (owner_id, lower(doi))      where doi is not null;
create unique index papers_arxiv_key on papers (owner_id, lower(arxiv_id)) where arxiv_id is not null;
create index papers_title_trgm on papers using gin (title gin_trgm_ops);
create index papers_owner_year on papers (owner_id, year desc nulls last);
create index papers_status_idx  on papers (owner_id, status) where not is_stub;
create index papers_venue_idx   on papers (venue_id);

-- ---------- edges ----------

create table paper_authors (
  paper_id  uuid not null references papers  on delete cascade,
  author_id uuid not null references authors on delete cascade,
  ord       smallint not null default 0,
  primary key (paper_id, author_id)
);
create index paper_authors_author_idx on paper_authors (author_id);

create table paper_tags (
  paper_id uuid not null references papers on delete cascade,
  tag_id   uuid not null references tags   on delete cascade,
  role     tag_role not null default 'about',
  primary key (paper_id, tag_id, role)
);
create index paper_tags_tag_idx on paper_tags (tag_id);

-- factual edge: A cites B
create table citations (
  citing_id uuid not null references papers on delete cascade,
  cited_id  uuid not null references papers on delete cascade,
  is_key    boolean not null default false,   -- one of the handful that actually matter
  note      text,                             -- why/where it is cited
  primary key (citing_id, cited_id),
  check (citing_id <> cited_id)
);
create index citations_cited_idx on citations (cited_id);

-- interpretive edge: your own reading of how two papers relate
create table paper_links (
  from_id uuid not null references papers on delete cascade,
  to_id   uuid not null references papers on delete cascade,
  kind    link_type not null,
  note    text,
  primary key (from_id, to_id, kind),
  check (from_id <> to_id)
);
create index paper_links_to_idx on paper_links (to_id);

-- ---------- reading ----------

-- the question set, as data. built-ins have owner_id null; you can add your own.
create table note_prompts (
  id        uuid primary key default gen_random_uuid(),
  owner_id  uuid references auth.users on delete cascade,
  key       text not null,
  title     text not null,
  guidance  text,
  ord       smallint not null default 0,
  is_active boolean not null default true
);
create unique index note_prompts_owner_key on note_prompts (owner_id, key) where owner_id is not null;
create unique index note_prompts_builtin_key on note_prompts (key) where owner_id is null;

create table paper_notes (
  paper_id   uuid not null references papers       on delete cascade,
  prompt_id  uuid not null references note_prompts on delete cascade,
  body       text not null default '',
  updated_at timestamptz not null default now(),
  primary key (paper_id, prompt_id)
);

create table excerpts (
  id         uuid primary key default gen_random_uuid(),
  paper_id   uuid not null references papers on delete cascade,
  page       smallint,
  quote      text not null,
  comment    text,
  created_at timestamptz not null default now()
);
create index excerpts_paper_idx on excerpts (paper_id);

create table collections (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users on delete cascade,
  name        text not null,
  description text,
  unique (owner_id, name)
);

create table collection_papers (
  collection_id uuid not null references collections on delete cascade,
  paper_id      uuid not null references papers      on delete cascade,
  ord           smallint not null default 0,
  primary key (collection_id, paper_id)
);
create index collection_papers_paper_idx on collection_papers (paper_id);

-- ---------- housekeeping ----------

create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger papers_touch      before update on papers      for each row execute function touch_updated_at();
create trigger paper_notes_touch before update on paper_notes for each row execute function touch_updated_at();

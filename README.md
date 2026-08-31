# research-db

Postgres/Supabase schema for a personal research library: papers as a graph, with a
fixed set of reading questions attached to each one.

## Model

**Nodes**

| table | notes |
|---|---|
| `papers` | title, abstract, year, DOI/arXiv, `cite_key`, `pdf_path` (storage), your `summary`, `status`, `rating` |
| `authors`, `venues` | deduped per user |
| `tags` | *one* table for topics, methods, datasets, tasks, metrics, applications — `kind` distinguishes them, `parent_id` nests them |
| `collections` | reading lists / per-project bibliographies |

**Edges**

| table | meaning |
|---|---|
| `citations` | A cites B. `is_key` marks the handful that actually matter, `note` says why |
| `paper_links` | *your* reading of the relation: `extends`, `contradicts`, `reproduces`, `applies`, `alternative_to`, `surveys`, `prerequisite_for`, `related` |
| `paper_tags` | with a `role`: `about`, `introduces`, `uses`, `evaluates_on`, `improves`, `compares_against` — so "papers that *introduce* an energy score" is a different query from "papers that *use* one" |
| `paper_authors` | ordered by `ord` |

**Reading**

- `note_prompts` — the 8 questions stored as *data*, not columns. The eight built-ins ship in
  `seed.sql` with their full guidance text; add your own rows and the UI picks them up with no migration.
- `paper_notes` — one row per (paper, prompt). Note completeness is just a count.
- `excerpts` — quotes with page number and a comment.

**Stubs.** A paper you only know as a reference gets a row with `is_stub = true`: enough to keep
the citation graph complete, filtered out of the reading list. Promote it by filling it in and
flipping the flag.

## Search

```
search_papers(q, max_results, filter_status, year_from, year_to, tag_ids, include_stubs)
  -> (id, rank, snippet)
```

One RPC covering title, abstract, your summary, your notes, your excerpts, author names, tag names
and `cite_key`. Terms are OR'd for recall and a row matching *every* term ranks 2×; trigram
matching catches typo'd titles; an exact `cite_key` ranks top as an identifier lookup. The snippet
comes back with `<mark>` tags. RLS applies, so it only sees your rows.

All arguments after `q` are optional. Filters are applied **inside** the query, before the rank
cut — passing them means you get the top N *matching rows*, not the top N overall with the
non-matching ones thrown away afterwards.

`paper_cards` — a view with authors, tags, note completeness and citation counts pre-aggregated,
so the list page is one query and no N+1.

## Graph

- `paper_edges` — every citation and link in one `(source, target, rel)` shape.
- `paper_graph(root uuid, depth int)` — edges within N hops, ready for d3/cytoscape/react-flow.
- `related_by_citation(root uuid)` — papers sharing the most references with this one.

## Apply

```bash
supabase link --project-ref <ref>
supabase db push
```

Migrations run in filename order, `0001_schema` through `0007_note_prompts`. The eight reading
questions are seeded by `0007`, not by `seed.sql` — `db push` never runs `seed.sql` against a
remote project, so seeding them there would leave production with no prompts.

## Notes for the Next.js app

- Everything is scoped by `owner_id` under RLS; use the anon key with the user's session, never
  the service role in the browser.
- PDFs go in the private `papers` bucket at `<user_id>/<paper_id>.pdf` — the storage policy
  requires that first path segment. Serve them with signed URLs.
- `cite_key` is unique per user, case-insensitively — it is what `\cite{...}` in your LaTeX
  resolves against.
- Generate types with `supabase gen types typescript --linked > types/db.ts`.
- Semantic search later is additive: `create extension vector`, add
  `embedding vector(1536)` to `papers` with an HNSW index, and blend the distance into
  `search_papers`. Nothing above needs to change.

## App

Next.js 16 (App Router) + Tailwind 4. Reads go through server components, writes through server
actions; there is no client data layer and no API routes beyond sign-out.

```bash
cp .env.local.example .env.local   # fill in project URL + publishable key
npm install
npm run dev
```

| route | what it does |
|---|---|
| `/` | library list; search box + status/year/stub filters, passed into the `search_papers` RPC |
| `/papers/new` | add a paper, or a stub reference |
| `/papers/[id]` | metadata, PDF upload, summary, the eight questions, tags, graph neighbourhood, excerpts |
| `/login` | email + password |

`proxy.ts` (Next 16's rename of `middleware.ts`) refreshes the Supabase session and redirects
signed-out visitors to `/login`.

Every editor on the paper page is its own one-field form that submits on blur — no page-wide save
button, and no client state to keep in sync with the row.

Adding an edge resolves the target by exact cite key first, then exact title. The datalist is
capped at 500 papers; past that it should move to the search RPC.

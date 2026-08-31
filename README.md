# research-db

Postgres/Supabase schema for a personal research library: papers as a graph, with a
fixed set of reading questions attached to each one.

## Model

**Nodes**

| table | notes |
|---|---|
| `papers` | title, abstract, year, DOI/arXiv, `pdf_path` (storage), your `summary`, `status`, `rating` |
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

`search_papers(q text, max_results int)` → `(id, rank, snippet)`. One RPC covering title,
abstract, your summary, your notes, your excerpts, author names and tag names. Terms are OR'd for
recall and a row matching *every* term ranks 2×; trigram matching catches typo'd titles. The
snippet comes back with `<mark>` tags. RLS applies, so it only sees your rows.

`paper_cards` — a view with authors, tags, note completeness and citation counts pre-aggregated,
so the list page is one query and no N+1.

## Graph

- `paper_edges` — every citation and link in one `(source, target, rel)` shape.
- `paper_graph(root uuid, depth int)` — edges within N hops, ready for d3/cytoscape/react-flow.
- `related_by_citation(root uuid)` — papers sharing the most references with this one.

## Apply

```bash
supabase db push          # or: psql "$DATABASE_URL" -f each migration in order, then seed.sql
```

Migrations run in filename order: `0001_schema` → `0002_search` → `0003_graph` → `0004_rls` →
`0005_storage`, then `seed.sql`.

## Notes for the Next.js app

- Everything is scoped by `owner_id` under RLS; use the anon key with the user's session, never
  the service role in the browser.
- PDFs go in the private `papers` bucket at `<user_id>/<paper_id>.pdf` — the storage policy
  requires that first path segment. Serve them with signed URLs.
- Generate types with `supabase gen types typescript --linked > types/db.ts`.
- Semantic search later is additive: `create extension vector`, add
  `embedding vector(1536)` to `papers` with an HNSW index, and blend the distance into
  `search_papers`. Nothing above needs to change.

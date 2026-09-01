# Research/db

A personal research library. Store what matters about every paper you read, connect papers to the
work they build on or argue with, and come back later to a record of what you read and a map of
what you know.

Live at [research-db-phi.vercel.app](https://research-db-phi.vercel.app).

## Why

Most reading gets lost. You finish a paper, feel like you understood it, and months later all that
survives is a title you half recognise. So every paper here carries the same eight questions, taken
from Griswold's [How to Read an Engineering Research
Paper](https://cseweb.ucsd.edu/~wgg/CSE210/howtoread.html) — motivation, solution, evaluation, your
own analysis, contributions, future directions, open questions, and a take-away. Answering them is
the point; the database is what makes the answers findable a year later.

## What it does

- **Store papers** — title, abstract, year, venue, DOI/arXiv, cite key, the PDF itself, and your
  own summary.
- **Answer the eight questions** per paper, saved as you type.
- **Tag** by topic, and mark quotes worth keeping with page numbers.
- **Connect papers** as `cites`, `related` or `contradicts`, and see the whole library as a graph
  you can pan, zoom and click through.
- **Search** across titles, abstracts, your summaries, your notes, your excerpts, authors, tags and
  cite keys, with filters for status, year and stubs.
- **Stubs** — record a paper you have only seen cited, so the graph stays complete without
  cluttering the reading list.

## Stack

Next.js 16 (App Router) and Tailwind 4 on the front, Supabase (Postgres, Auth, Storage) behind.
Reads go through server components, writes through server actions. There is no client data layer
and no API routes beyond sign-out.

## Running it yourself

You need Node 20+, a free [Supabase](https://supabase.com) project, and a Google OAuth client.

```bash
git clone https://github.com/hasanahmed77/research-db.git
cd research-db
npm install
cp .env.local.example .env.local     # fill in the two values below
```

`.env.local` needs your project URL and publishable key, both from Supabase → Project Settings →
API:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
```

Apply the schema:

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push
```

Then set up Google sign-in, which lives in two consoles rather than in this repo:

1. Google Cloud → **Google Auth Platform → Clients** → create a Web client, with
   `https://<project-ref>.supabase.co/auth/v1/callback` as the authorised redirect URI. Leave
   authorised JavaScript origins empty; the browser talks to Supabase, not to Google, so there is
   no origin to authorise.
2. Supabase → **Authentication → Sign In / Providers → Google** → paste the client ID and secret.
3. Supabase → **Authentication → URL Configuration** → set the Site URL, and add
   `http://localhost:3000/**` to the redirect allow-list. Without this Supabase discards the
   redirect and sends you to the Site URL instead.

```bash
npm run dev
```

## How the data is shaped

**Nodes**

| table | notes |
|---|---|
| `papers` | metadata, `cite_key`, `pdf_path` in storage, your `summary`, `status`, `rating` |
| `authors`, `venues` | deduped per user |
| `tags` | one table for topics, methods, datasets, tasks, metrics — `kind` distinguishes them, `parent_id` nests them |
| `collections` | reading lists and per-project bibliographies |

**Edges**

| table | meaning |
|---|---|
| `citations` | A cites B. `is_key` marks the few that matter, `note` says why |
| `paper_links` | your reading of the relation — `related`, `contradicts` and others the schema still allows |
| `paper_tags` | carries a `role`, so "papers that *introduce* a method" is a different query from "papers that *use* one" |

**Reading**

`note_prompts` holds the eight questions as data rather than as columns, so you can add your own
without a migration. `paper_notes` is one row per paper and prompt, and note completeness is a
count. `excerpts` holds quotes with page numbers.

**Functions**

- `search_papers(q, max_results, status, year_from, year_to, tag_ids, include_stubs)` — one RPC over
  every searchable field. Terms are OR'd for recall, a row matching every term ranks twice as high,
  and trigram matching catches typo'd titles. Filters apply inside the query, before the rank cut.
- `paper_graph(root, depth)` — the neighbourhood around one paper.
- `related_by_citation(root)` — papers sharing the most references with this one.
- `paper_cards` — a view with authors, tags, note completeness and citation counts pre-aggregated.

Everything is scoped by `owner_id` under row level security, so a deployment is single-tenant per
signed-in user.

## Contributing

Contributions are welcome. You do not need write access to this repository and will not be given
any — the flow is fork, branch, pull request:

```bash
# 1. Fork on GitHub, then clone your fork
git clone https://github.com/<your-username>/research-db.git
cd research-db

# 2. Branch
git checkout -b short-description-of-change

# 3. Make the change, and make sure it builds
npm run build

# 4. Push to your fork and open a pull request against hasanahmed77/research-db
git push origin short-description-of-change
```

A few things that make a change easy to accept:

- **Keep it to one thing.** A pull request that fixes a bug and also restyles three pages is hard
  to review and harder to revert.
- **Say what breaks if you are wrong.** "This could double-write on a slow connection" is more
  useful than "fixed a bug".
- **Schema changes go in a new numbered migration** under `supabase/migrations/`. Never edit an
  applied one — anyone who has already run it will not get your change.
- **`npm run build` has to pass.** It type-checks as well as compiles.

Bug reports are just as welcome as code. Include what you did, what you expected, and what actually
happened.

## Next

- `is_key` on the citation form — the schema has the flag, the UI has no control for it.
- Importing a paper's references from a DOI, so the citation graph fills itself.
- Semantic search — add `pgvector`, an `embedding` column on `papers`, and blend the distance into
  `search_papers`. Nothing above needs to change.

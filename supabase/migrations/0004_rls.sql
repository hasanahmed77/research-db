-- everything is scoped to the signed-in user

create or replace function owns_paper(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from papers where id = p and owner_id = auth.uid());
$$;

create or replace function owns_collection(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from collections where id = c and owner_id = auth.uid());
$$;

alter table papers      enable row level security;
alter table authors     enable row level security;
alter table venues      enable row level security;
alter table tags        enable row level security;
alter table collections enable row level security;

create policy owner_rw on papers      for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy owner_rw on authors     for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy owner_rw on venues      for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy owner_rw on tags        for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy owner_rw on collections for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

alter table paper_authors enable row level security;
alter table paper_tags    enable row level security;
alter table paper_notes   enable row level security;
alter table excerpts      enable row level security;

create policy owner_rw on paper_authors for all using (owns_paper(paper_id)) with check (owns_paper(paper_id));
create policy owner_rw on paper_tags    for all using (owns_paper(paper_id)) with check (owns_paper(paper_id));
create policy owner_rw on paper_notes   for all using (owns_paper(paper_id)) with check (owns_paper(paper_id));
create policy owner_rw on excerpts      for all using (owns_paper(paper_id)) with check (owns_paper(paper_id));

alter table citations   enable row level security;
alter table paper_links enable row level security;

create policy owner_rw on citations   for all
  using (owns_paper(citing_id) and owns_paper(cited_id))
  with check (owns_paper(citing_id) and owns_paper(cited_id));
create policy owner_rw on paper_links for all
  using (owns_paper(from_id) and owns_paper(to_id))
  with check (owns_paper(from_id) and owns_paper(to_id));

alter table collection_papers enable row level security;
create policy owner_rw on collection_papers for all
  using (owns_collection(collection_id) and owns_paper(paper_id))
  with check (owns_collection(collection_id) and owns_paper(paper_id));

-- built-in prompts (owner_id null) are readable by everyone, editable by no one
alter table note_prompts enable row level security;
create policy read_builtin_and_own on note_prompts for select
  using (owner_id is null or owner_id = auth.uid());
create policy write_own on note_prompts for insert with check (owner_id = auth.uid());
create policy update_own on note_prompts for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy delete_own on note_prompts for delete using (owner_id = auth.uid());

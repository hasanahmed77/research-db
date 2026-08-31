-- private bucket for PDFs. object path must be <uid>/<paper_id>.pdf
insert into storage.buckets (id, name, public)
values ('papers', 'papers', false)
on conflict (id) do nothing;

create policy "own pdfs" on storage.objects for all
  to authenticated
  using      (bucket_id = 'papers' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'papers' and (storage.foldername(name))[1] = auth.uid()::text);

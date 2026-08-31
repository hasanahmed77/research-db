-- The built-in reading questions.
-- These live in a migration rather than seed.sql because the app depends on
-- them: `supabase db push` never runs seed.sql against a remote project, so a
-- seeded-only version would leave production with no prompts at all.
insert into note_prompts (owner_id, key, title, guidance, ord) values
(null, 'motivation', 'What are the motivations for this work?', $g$Two parts. The people problem: what benefit in the world is wanted (time saved, safety, cost)? The technical problem: why is there no trivial solution? Then: what were the previous solutions and why are they inadequate? Finally, distil to the research question the paper actually sets out to answer — often narrower than the problem stated up front, and often not stated explicitly at all.$g$, 1),
(null, 'solution', 'What is the proposed solution?', $g$The hypothesis or idea — the proposed answer to the research question. Why should it work, and why should it beat prior solutions? How is it designed and implemented, or at least shown to be achievable?$g$, 2),
(null, 'evaluation', 'How is the solution evaluated?', $g$An idea alone is not a paper. What argument, implementation or experiment makes the case? What benefits and what problems does the evaluation surface?$g$, 3),
(null, 'analysis', 'What is your analysis?', $g$Is this a good idea? What flaws do you see in problem, idea or evaluation? Most interesting points? Most controversial? If it has practical implications: will it really work, who wants it, what would it take to ship, and when could it be real?$g$, 4),
(null, 'contributions', 'What are the contributions?', $g$Beyond the answer to the research question: ideas, software, datasets, experimental techniques, a survey of an area, a new framing.$g$, 5),
(null, 'future_work', 'What are future directions?', $g$Both the ones the authors name and the ones that occurred to you while reading. Shortcomings and critiques usually point straight at these.$g$, 6),
(null, 'questions', 'What questions are you left with?', $g$What would you raise in an open discussion? What is confusing or hard to follow? Listing several forces you to think harder about the work.$g$, 7),
(null, 'takeaway', 'What is your take-away message?', $g$The essence of the paper in your own words, one or two sentences. This is what you will actually reread months later.$g$, 8)
on conflict do nothing;

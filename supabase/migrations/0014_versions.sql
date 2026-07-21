-- Mockup versioning: a "file" is a stack of versions that share a version_group.
-- Each version is its own mockups row (so pins/comments stay attached to the
-- exact version they were left on). The grid collapses a group to its latest
-- version; the viewer offers a version switcher + compare.

alter table public.mockups add column version int not null default 1;

-- A volatile default is evaluated per row, so every existing mockup becomes its
-- own single-version group. New standalone uploads likewise get a fresh group;
-- an uploaded *version* explicitly copies its base's version_group.
alter table public.mockups add column version_group uuid not null default gen_random_uuid();

create index if not exists mockups_version_group_idx on public.mockups (version_group);

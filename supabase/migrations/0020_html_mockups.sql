-- Allow HTML files as a mockup type (rendered live in a sandboxed iframe).
alter table public.mockups drop constraint if exists mockups_type_check;
alter table public.mockups
  add constraint mockups_type_check check (type in ('image', 'pdf', 'figma', 'html'));

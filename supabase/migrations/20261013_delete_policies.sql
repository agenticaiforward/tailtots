-- TailTots migration: allow parents to delete their family's child data.
--
-- COPPA §312.10 gives parents the right to delete their child's personal
-- information. The DELETE /api/family/data worker endpoint performs the
-- deletion with the parent's own JWT, so Row Level Security must permit it.
--
-- Most child-data tables already have FOR ALL policies (which include
-- DELETE). The only gap is blueprint_snapshots, which has read+insert
-- only. This migration adds the missing DELETE policy, scoped to the
-- parent's own family via current_parent_family_ids().
--
-- Apply once in the Supabase dashboard: SQL Editor > paste > Run.

drop policy if exists blueprint_snapshots_parent_delete on blueprint_snapshots;
create policy blueprint_snapshots_parent_delete on blueprint_snapshots
  for delete using (family_id in (select current_parent_family_ids()));

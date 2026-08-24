-- Guest mode (20260326233134_make_storage_guest_friendly) made the
-- project-files bucket work for anonymous visitors by granting anon every verb
-- on storage.objects, scoped only by bucket_id. The anon key ships in the
-- client bundle, so "Anon can delete" meant any visitor could remove every
-- uploaded photo in the bucket, and "Anon can update" could overwrite them.
-- These are original photographs of real people — the memorial portraits this
-- product exists to print. There is no undo.
--
-- The application needs neither verb:
--   * uploads use crypto.randomUUID() filenames, so nothing is ever overwritten
--   * nothing in the app lists or deletes objects (deleteFile() was exported
--     and never called; it is removed in this change)
--
-- Insert is all guest mode requires. Reads keep working because the bucket is
-- public, and the public object path does not consult these policies.
--
-- If deletion is ever needed, it belongs on the server with the service-role
-- client behind the ownership check in lib/api/ownership.ts — never on a key
-- that is handed to every visitor.

drop policy if exists "Anon can update" on storage.objects;
drop policy if exists "Anon can delete" on storage.objects;

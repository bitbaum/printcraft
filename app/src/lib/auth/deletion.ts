import 'server-only';
import { createAdminClient, GUEST_USER_ID } from '@/lib/supabase/admin';

const BUCKET = 'project-files';

/**
 * A deleted account's projects and photos. When people were GoTrue users,
 * deleting the auth.users row cascaded to their projects (and from those to
 * surfaces, figures, compositions and exports). Since accounts are
 * AccountKit's, deleting an account (AccountPanel → /api/auth/delete-user)
 * calls this instead. Their uploads live under `<user id>/` in the bucket
 * (src/lib/supabase/storage.ts getStoragePath). Logs failures; never throws.
 */
export async function removePersonData(userId: string): Promise<void> {
  // The shared guest's projects are everyone's who has no account; no account holds its id.
  if (!userId || userId === GUEST_USER_ID) return;
  const supabase = createAdminClient();
  try {
    const { data: projects } = await supabase.from('projects').select('id').eq('user_id', userId);
    for (const { id } of projects ?? []) {
      for (const folder of ['originals', 'styled', 'backgrounds', 'exports']) {
        const prefix = `${userId}/${id}/${folder}`;
        const { data: files } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000 });
        const paths = (files ?? []).map((f) => `${prefix}/${f.name}`);
        if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
      }
    }
  } catch (error) {
    console.error('[accounts] removing a deleted person’s photos failed', (error as Error).name);
  }
  const { error } = await supabase.from('projects').delete().eq('user_id', userId);
  if (error) console.error('[accounts] removing a deleted person’s projects failed', error.code);
}

import type { getApiClient } from '@/lib/supabase/api-client'

/**
 * Authorization for the API layer.
 *
 * Anonymous callers are served by the service-role client so that guest mode
 * works without a login — and the service role bypasses row-level security.
 * That makes RLS unable to answer "may this caller touch this row", so every
 * route has to ask here instead. Filtering on an id that arrived in the request
 * is not a check: the id is what the caller controls.
 *
 * Everything in this app hangs off a project, so project ownership is the only
 * question there is.
 */

type ApiSupabase = Awaited<ReturnType<typeof getApiClient>>['supabase']

export async function ownsProject(
  supabase: ApiSupabase,
  projectId: string,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', userId)
    .maybeSingle()

  return Boolean(data)
}

export async function ownsFigure(
  supabase: ApiSupabase,
  figureId: string,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('figures')
    .select('project_id')
    .eq('id', figureId)
    .maybeSingle()

  if (!data?.project_id) return false
  return ownsProject(supabase, data.project_id, userId)
}

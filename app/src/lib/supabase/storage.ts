import { createClient } from './client'

const BUCKET = 'project-files'

export async function uploadFile(
  path: string,
  file: File
): Promise<{ path: string; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.storage
    .from(BUCKET)
    // No upsert: paths are randomly named, so an upload that lands on an
    // existing object is a collision or an attempt to overwrite, not an edit.
    .upload(path, file, { upsert: false })

  if (error) return { path: '', error: error.message }
  return { path: data.path, error: null }
}

/** Public URL — works because the bucket is public. No auth needed. */
export function getImageUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`
}

/**
 * There is deliberately no delete helper. Removing an object is destructive and
 * cannot be authorized from the browser, where the anon key is public to every
 * visitor. If deletion is ever needed, do it server-side with the service-role
 * client behind the ownership check in lib/api/ownership.ts.
 */

export function getStoragePath(
  userId: string,
  projectId: string,
  type: 'originals' | 'styled' | 'backgrounds' | 'exports',
  filename: string
): string {
  return `${userId}/${projectId}/${type}/${filename}`
}

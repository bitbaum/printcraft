import { NextResponse, type NextRequest } from 'next/server'
import { getApiClient } from '@/lib/supabase/api-client'
import { upsertSurfaceSchema } from '@/lib/schemas/validation'
import { ownsProject } from '@/lib/api/ownership'

export async function GET(request: NextRequest) {
  const { supabase, userId } = await getApiClient()

  const projectId = request.nextUrl.searchParams.get('project_id')
  if (!projectId) return NextResponse.json({ success: false, error: 'project_id required' }, { status: 400 })
  if (!(await ownsProject(supabase, projectId, userId))) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('surfaces')
    .select('*')
    .eq('project_id', projectId)
    .single()

  if (error) return NextResponse.json({ success: false, data: null })
  return NextResponse.json({ success: true, data })
}

export async function POST(request: NextRequest) {
  const { supabase, userId } = await getApiClient()

  const body = await request.json()
  const parsed = upsertSurfaceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid data', details: parsed.error.flatten() }, { status: 400 })
  }

  if (!(await ownsProject(supabase, parsed.data.project_id, userId))) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  }

  // Upsert: delete existing surface for project, then insert
  await supabase.from('surfaces').delete().eq('project_id', parsed.data.project_id)

  const { data, error } = await supabase
    .from('surfaces')
    .insert(parsed.data)
    .select()
    .single()

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data })
}

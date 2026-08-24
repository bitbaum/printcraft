import { NextResponse, type NextRequest } from 'next/server'
import { getApiClient } from '@/lib/supabase/api-client'
import { updateProjectSchema } from '@/lib/schemas/validation'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const { supabase, userId } = await getApiClient()

  // Scoped to the caller, not just the id they sent — this select pulls every
  // figure in the project, which is photographs of real people.
  const { data, error } = await supabase
    .from('projects')
    .select('*, style:styles(*), figures(*)')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 404 })
  return NextResponse.json({ success: true, data })
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const { supabase, userId } = await getApiClient()

  const body = await request.json()
  const parsed = updateProjectSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid data', details: parsed.error.flatten() }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('projects')
    .update(parsed.data)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .maybeSingle()

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true, data })
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const { supabase, userId } = await getApiClient()

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

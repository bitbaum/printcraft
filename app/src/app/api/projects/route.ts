import { NextResponse, type NextRequest } from 'next/server'
import { getApiClient } from '@/lib/supabase/api-client'
import { createProjectSchema } from '@/lib/schemas/validation'

export async function GET() {
  const { supabase, userId } = await getApiClient()

  const { data, error } = await supabase
    .from('projects')
    // Ids only, and in one round trip: the dashboard badge reports progress
    // from these rows rather than from a status column nothing ever wrote.
    .select('*, style:styles(*), figures(id), surfaces(id), compositions(id)')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data })
}

export async function POST(request: NextRequest) {
  const { supabase, userId } = await getApiClient()

  const body = await request.json()
  const parsed = createProjectSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid data', details: parsed.error.flatten() }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('projects')
    .insert({ ...parsed.data, user_id: userId })
    .select()
    .single()

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data }, { status: 201 })
}

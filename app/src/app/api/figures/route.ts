import { NextResponse, type NextRequest } from 'next/server';
import { getApiClient } from '@/lib/supabase/api-client';
import { createFigureSchema } from '@/lib/schemas/validation';
import { ownsProject } from '@/lib/api/ownership';

export async function GET(request: NextRequest) {
  const { supabase, userId } = await getApiClient();

  const projectId = request.nextUrl.searchParams.get('project_id');
  if (!projectId)
    return NextResponse.json({ success: false, error: 'project_id required' }, { status: 400 });
  const ownership = await ownsProject(supabase, projectId, userId);
  if (ownership.error)
    return NextResponse.json({ success: false, error: ownership.error }, { status: 500 });
  if (!ownership.owns) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  const { data, error } = await supabase
    .from('figures')
    .select('*')
    .eq('project_id', projectId)
    .order('z_depth', { ascending: true });

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}

export async function POST(request: NextRequest) {
  const { supabase, userId } = await getApiClient();

  const body = await request.json();
  const parsed = createFigureSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid data', details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const ownership = await ownsProject(supabase, parsed.data.project_id, userId);
  if (ownership.error)
    return NextResponse.json({ success: false, error: ownership.error }, { status: 500 });
  if (!ownership.owns) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  const { data, error } = await supabase.from('figures').insert(parsed.data).select().single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data }, { status: 201 });
}

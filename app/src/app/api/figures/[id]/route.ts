import { NextResponse, type NextRequest } from 'next/server';
import { getApiClient } from '@/lib/supabase/api-client';
import { updateFigureSchema } from '@/lib/schemas/validation';
import { ownsFigure } from '@/lib/api/ownership';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const { supabase, userId } = await getApiClient();

  const body = await request.json();
  const parsed = updateFigureSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid data', details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  if (!(await ownsFigure(supabase, id, userId))) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  const { data, error } = await supabase
    .from('figures')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const { supabase, userId } = await getApiClient();

  if (!(await ownsFigure(supabase, id, userId))) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  const { error } = await supabase.from('figures').delete().eq('id', id);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

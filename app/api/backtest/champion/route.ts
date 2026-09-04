import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json() as { backtestRunId?: string; itemId?: string; modelId?: string; reason?: string };
    if (!body.backtestRunId || !body.itemId || !body.modelId || !body.reason?.trim()) return NextResponse.json({ error: 'backtestRunId, itemId, modelId, reason이 모두 필요합니다.' }, { status: 400 });
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.schema('core').rpc('set_manual_champion', { p_backtest_run_id: body.backtestRunId, p_item_id: body.itemId, p_model_id: body.modelId, p_reason: body.reason.trim() });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ championId: data });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Champion 변경에 실패했습니다.' }, { status: 500 }); }
}

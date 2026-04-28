import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const { playerName, type, message } = await req.json();

  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  const supabase = createServerClient();

  const { error } = await supabase
    .from('feedback')
    .insert({
      player_name: playerName?.trim() || 'Anonymous',
      type: type || 'bug',
      message: message.trim(),
    });

  if (error) {
    return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getPlayer, getActiveAttacksOn, getMyCooldowns } from '@/lib/db';

function getPlayerId(req: NextRequest): string | null {
  return req.cookies.get('player_id')?.value ?? null;
}

export async function GET(req: NextRequest) {
  const playerId = getPlayerId(req);
  if (!playerId) return NextResponse.json({ error: 'Not identified' }, { status: 401 });

  const player = getPlayer(playerId);
  if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

  const activeAttacks = getActiveAttacksOn(playerId);
  const myCooldowns = getMyCooldowns(playerId);

  return NextResponse.json({ activeAttacks, myCooldowns });
}

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createPlayer, getPlayer } from '@/lib/db';
import { serializeState, initialGameState } from '@/lib/game-engine';
import { upsertGameState } from '@/lib/db';

export async function POST(req: NextRequest) {
  const { name } = await req.json() as { name?: string };
  if (!name || name.trim().length === 0) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  // Check if player already has a cookie
  const existingId = req.cookies.get('player_id')?.value;
  if (existingId) {
    const player = getPlayer(existingId);
    if (player) {
      return NextResponse.json({ id: player.id, name: player.name });
    }
  }

  const id = uuidv4();
  createPlayer(id, name.trim());

  // Create initial game state
  const initial = initialGameState();
  upsertGameState(id, 0, serializeState(initial));

  const res = NextResponse.json({ id, name: name.trim() });
  res.cookies.set('player_id', id, {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: 'lax',
  });
  return res;
}

export async function GET(req: NextRequest) {
  const playerId = req.cookies.get('player_id')?.value;
  if (!playerId) {
    return NextResponse.json({ identified: false });
  }
  const player = getPlayer(playerId);
  if (!player) {
    return NextResponse.json({ identified: false });
  }
  return NextResponse.json({ identified: true, id: player.id, name: player.name });
}

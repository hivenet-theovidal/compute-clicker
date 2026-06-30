export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getGameState, upsertGameState, getPlayer } from '@/lib/db';
import {
  deserializeState,
  serializeState,
  initialGameState,
  validateStateDelta,
  type FullGameState,
} from '@/lib/game-engine';

function getPlayerId(req: NextRequest): string | null {
  return req.cookies.get('player_id')?.value ?? null;
}

export async function GET(req: NextRequest) {
  const playerId = getPlayerId(req);
  if (!playerId) return NextResponse.json({ error: 'Not identified' }, { status: 401 });

  const player = getPlayer(playerId);
  if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

  const row = getGameState(playerId);
  if (!row) {
    const initial = initialGameState();
    return NextResponse.json({ state: initial });
  }

  const state = deserializeState(row.state_json);
  return NextResponse.json({ state });
}

export async function POST(req: NextRequest) {
  const playerId = getPlayerId(req);
  if (!playerId) return NextResponse.json({ error: 'Not identified' }, { status: 401 });

  const player = getPlayer(playerId);
  if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

  const body = await req.json() as { state?: FullGameState };
  if (!body.state) return NextResponse.json({ error: 'Missing state' }, { status: 400 });

  const incoming = body.state;

  // Anti-cheat: compare with stored state
  const row = getGameState(playerId);
  const previous = row ? deserializeState(row.state_json) : null;

  if (!validateStateDelta(previous, incoming)) {
    return NextResponse.json({ error: 'Invalid state delta' }, { status: 400 });
  }

  upsertGameState(playerId, incoming.totalEarned, serializeState(incoming));
  return NextResponse.json({ ok: true });
}

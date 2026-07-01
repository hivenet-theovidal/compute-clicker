export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import {
  getPlayer,
  getGameState,
  upsertGameState,
  createAttack,
  getAttackCooldown,
  getPlayerTotalEarned,
} from '@/lib/db';
import { deserializeState, serializeState, ATTACK_DURATION_MS } from '@/lib/game-engine';

function getPlayerId(req: NextRequest): string | null {
  return req.cookies.get('player_id')?.value ?? null;
}

export async function POST(req: NextRequest) {
  const attackerId = getPlayerId(req);
  if (!attackerId) return NextResponse.json({ error: 'Not identified' }, { status: 401 });

  const attacker = getPlayer(attackerId);
  if (!attacker) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

  const body = await req.json() as { targetId?: string };
  if (!body.targetId) return NextResponse.json({ error: 'Missing targetId' }, { status: 400 });

  const { targetId } = body;
  if (targetId === attackerId) return NextResponse.json({ error: 'Cannot attack yourself' }, { status: 400 });

  const target = getPlayer(targetId);
  if (!target) return NextResponse.json({ error: 'Target not found' }, { status: 404 });

  // Load states for cost calculation
  const attackerStateRow = getGameState(attackerId);
  if (!attackerStateRow) return NextResponse.json({ error: 'Attacker has no game state' }, { status: 400 });

  const attackerTotal = attackerStateRow.total_earned;
  const targetTotal = getPlayerTotalEarned(targetId);

  const cost = Math.max(10, (attackerTotal + targetTotal) * 0.005);

  // Check balance
  const attackerState = deserializeState(attackerStateRow.state_json);
  if (attackerState.balance < cost) {
    return NextResponse.json({ error: 'Insufficient balance', cost }, { status: 400 });
  }

  // Check cooldown
  const cooldownMs = getAttackCooldown(attackerId, targetId);
  if (cooldownMs !== null) {
    return NextResponse.json({ error: 'Attack on cooldown', remainingMs: cooldownMs }, { status: 429 });
  }

  // Deduct cost and save attacker state
  const newAttackerState = { ...attackerState, balance: attackerState.balance - cost };
  upsertGameState(attackerId, newAttackerState.totalEarned, serializeState(newAttackerState));

  // Create attack
  const expiresAt = Date.now() + ATTACK_DURATION_MS;
  createAttack(attackerId, targetId, cost, expiresAt);

  return NextResponse.json({ ok: true, cost, expiresAt });
}

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getLeaderboard } from '@/lib/db';

export async function GET(_req: NextRequest) {
  const entries = getLeaderboard(20);
  return NextResponse.json({ leaderboard: entries });
}


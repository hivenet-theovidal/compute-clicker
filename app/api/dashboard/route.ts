export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getDashboardStats } from '@/lib/db';

export async function GET() {
  const stats = getDashboardStats();
  return NextResponse.json(stats, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type {
  DashboardStats,
  ActiveAttackEntry,
  RecentAttackEntry,
  LeaderboardEntry,
} from '@/lib/db';
import { formatEuros, REGIONS, type RegionId } from '@/lib/game-engine';

const REFRESH_MS = 5000;

const COMPONENT_LABELS: Record<string, string> = {
  cpu: 'CPU', ram: 'RAM', gpu: 'GPU',
  power: 'Power', bandwidth: 'Bandwidth', container: 'Container',
};
const COMPONENT_COLORS: Record<string, string> = {
  cpu: '#4A90D9', ram: '#50C878', gpu: '#7B68EE',
  power: '#F5A623', bandwidth: '#FF6B6B', container: '#50C878',
};
const REGION_LABELS: Record<string, string> = {
  uae: 'UAE', eu: 'Europe', us: 'United States', sea: 'SE Asia', brazil: 'Brazil',
};

// ── Helpers ───────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)  return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function countdown(expiresAt: number): string {
  const ms = Math.max(0, expiresAt - Date.now());
  const s  = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function useClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-GB'));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

// ── Sub-components ────────────────────────────────────────────

function KpiTile({ label, value, sub, color = '#F5A623' }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl px-6 py-5 flex flex-col gap-1">
      <div className="text-slate-500 text-sm uppercase tracking-widest">{label}</div>
      <div className="text-4xl font-bold tabular-nums" style={{ color }}>{value}</div>
      {sub && <div className="text-slate-500 text-xs">{sub}</div>}
    </div>
  );
}

function HBar({ label, value, max, color }: {
  label: string; value: number; max: number; color: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-24 text-slate-400 text-sm text-right shrink-0">{label}</div>
      <div className="flex-1 h-4 bg-slate-800 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      <div className="w-16 text-right text-sm font-mono tabular-nums" style={{ color }}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function LeaderboardRow({ entry, rank, max }: {
  entry: LeaderboardEntry; rank: number; max: number;
}) {
  const pct = max > 0 ? (entry.total_earned / max) * 100 : 0;
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
  const rankColor = rank === 1 ? '#FBBF24' : rank === 2 ? '#94A3B8' : rank === 3 ? '#F97316' : '#475569';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${rank <= 3 ? 'bg-slate-800/60' : ''}`}
    >
      <div className="w-8 text-center shrink-0">
        {medal ?? (
          <span className="font-bold text-lg" style={{ color: rankColor }}>{rank}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`font-semibold truncate ${rank === 1 ? 'text-yellow-300 text-xl' : rank <= 3 ? 'text-white text-lg' : 'text-slate-300 text-base'}`}>
          {entry.name}
        </div>
        <div className="mt-1 h-2 bg-slate-700 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: rank === 1 ? '#FBBF24' : '#4A90D9' }}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.7, delay: rank * 0.04 }}
          />
        </div>
      </div>
      <div className={`font-mono tabular-nums font-bold shrink-0 ${rank === 1 ? 'text-yellow-300 text-xl' : rank <= 3 ? 'text-slate-200 text-lg' : 'text-slate-400 text-base'}`}>
        {formatEuros(entry.total_earned)}
      </div>
    </motion.div>
  );
}

function ActiveAttackCard({ attack }: { attack: ActiveAttackEntry }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const ms        = Math.max(0, attack.expires_at - Date.now());
  const totalMs   = attack.expires_at - attack.created_at;
  const pct       = totalMs > 0 ? (ms / totalMs) * 100 : 0;
  const cd        = countdown(attack.expires_at);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="bg-red-950/40 border border-red-800/50 rounded-xl px-4 py-3 space-y-2"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-red-400 text-lg shrink-0">⚔</span>
          <span className="text-white font-semibold text-base truncate">{attack.attacker_name}</span>
          <span className="text-slate-500 text-sm shrink-0">→</span>
          <span className="text-red-300 font-semibold text-base truncate">{attack.target_name}</span>
        </div>
        <div className="font-mono text-red-300 text-base font-bold shrink-0">{cd}</div>
      </div>
      <div className="h-1.5 bg-red-900/50 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-red-500 rounded-full"
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: 'linear' }}
        />
      </div>
      <div className="text-red-400/70 text-xs">−30% income on target</div>
    </motion.div>
  );
}

function RecentAttackRow({ attack }: { attack: RecentAttackEntry }) {
  const active = attack.expires_at > Date.now();
  return (
    <div className={`flex items-center gap-3 text-sm py-1 ${active ? 'text-red-300' : 'text-slate-500'}`}>
      <span className="shrink-0">{active ? '⚔' : '·'}</span>
      <span className="font-semibold truncate max-w-[7rem]">{attack.attacker_name}</span>
      <span className="text-slate-600">→</span>
      <span className="truncate max-w-[7rem]">{attack.target_name}</span>
      <span className="ml-auto shrink-0 text-xs tabular-nums">{timeAgo(attack.created_at)}</span>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────

export default function DashboardPage() {
  const [stats, setStats]     = useState<DashboardStats | null>(null);
  const [prev, setPrev]       = useState<DashboardStats | null>(null);
  const [lastRefresh, setLastRefresh] = useState<number>(Date.now());
  const [refreshIn, setRefreshIn]     = useState(REFRESH_MS);
  const clock = useClock();

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/dashboard');
      const data: DashboardStats = await res.json();
      setPrev(s => s);
      setStats(data);
      setLastRefresh(Date.now());
      setRefreshIn(REFRESH_MS);
    } catch { /* silent */ }
  };

  // Initial + interval fetch
  useEffect(() => {
    fetchStats();
    const id = setInterval(fetchStats, REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  // Countdown to next refresh
  useEffect(() => {
    const id = setInterval(() => setRefreshIn(r => Math.max(0, r - 200)), 200);
    return () => clearInterval(id);
  }, [lastRefresh]);

  if (!stats) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-500 text-lg animate-pulse">Loading dashboard…</div>
      </div>
    );
  }

  const topEarned     = stats.topPlayers[0]?.total_earned ?? 1;
  const compEntries   = Object.entries(stats.componentTotals) as [string, number][];
  const maxComp       = Math.max(...compEntries.map(([, v]) => v), 1);
  const regionEntries = Object.entries(stats.regionUnlocks) as [string, number][];
  const maxRegion     = Math.max(...regionEntries.map(([, v]) => v), 1);

  return (
    <div
      className="min-h-screen bg-slate-950 text-white flex flex-col overflow-hidden"
      style={{ backgroundImage: 'url(/assets/bg-pattern.svg)', backgroundSize: '60px 60px' }}
    >
      {/* Overlay to dim pattern */}
      <div className="fixed inset-0 bg-slate-950/85 pointer-events-none" />

      <div className="relative flex flex-col h-screen">
        {/* ── Header ── */}
        <header className="flex items-center justify-between px-8 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-4">
            <span className="text-yellow-400 font-bold text-2xl tracking-tight">HiveNet</span>
            <span className="text-slate-500 text-lg">·</span>
            <span className="text-slate-300 text-lg font-semibold uppercase tracking-widest">Global Dashboard</span>
          </div>
          <div className="flex items-center gap-6">
            {/* Refresh bar */}
            <div className="flex items-center gap-2">
              <div className="w-24 h-1 bg-slate-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-green-500 rounded-full"
                  animate={{ width: `${(refreshIn / REFRESH_MS) * 100}%` }}
                  transition={{ duration: 0.2 }}
                />
              </div>
              <span className="text-slate-600 text-xs">LIVE</span>
            </div>
            <div className="text-slate-400 font-mono text-xl">{clock}</div>
          </div>
        </header>

        {/* ── 3-column grid ── */}
        <div className="flex flex-1 overflow-hidden">

          {/* ── LEFT — Leaderboard ── */}
          <div className="w-[32%] flex flex-col border-r border-slate-800 overflow-y-auto">
            <div className="px-6 pt-6 pb-3 shrink-0">
              <h2 className="text-slate-400 text-xs uppercase tracking-[0.2em] font-semibold">
                Global Leaderboard
              </h2>
            </div>
            <div className="flex-1 px-4 pb-6 space-y-1">
              <AnimatePresence mode="popLayout">
                {stats.topPlayers.map((entry, i) => (
                  <LeaderboardRow
                    key={entry.player_id}
                    entry={entry}
                    rank={i + 1}
                    max={topEarned}
                  />
                ))}
              </AnimatePresence>
              {stats.topPlayers.length === 0 && (
                <div className="text-slate-700 text-center py-12 text-lg">No players yet</div>
              )}
            </div>
          </div>

          {/* ── CENTER — Global stats ── */}
          <div className="flex-1 flex flex-col overflow-y-auto">
            <div className="px-6 pt-6 pb-3 shrink-0">
              <h2 className="text-slate-400 text-xs uppercase tracking-[0.2em] font-semibold">
                Global Statistics
              </h2>
            </div>

            <div className="px-6 pb-6 space-y-6">
              {/* KPI tiles */}
              <div className="grid grid-cols-2 gap-4">
                <KpiTile
                  label="Active Players"
                  value={stats.playerCount.toString()}
                  color="#4A90D9"
                />
                <KpiTile
                  label="Global Total Earned"
                  value={formatEuros(stats.globalTotalEarned)}
                  color="#FBBF24"
                />
                <KpiTile
                  label="Live Attacks"
                  value={stats.activeAttacks.length.toString()}
                  sub={stats.activeAttacks.length > 0 ? 'players under attack' : 'all clear'}
                  color={stats.activeAttacks.length > 0 ? '#EF4444' : '#50C878'}
                />
                <KpiTile
                  label="Total Components"
                  value={Object.values(stats.componentTotals).reduce((a, b) => a + b, 0).toLocaleString()}
                  sub="across all regions"
                  color="#7B68EE"
                />
              </div>

              {/* Component popularity */}
              <div className="bg-slate-900 border border-slate-700 rounded-2xl px-6 py-5 space-y-3">
                <h3 className="text-slate-400 text-xs uppercase tracking-widest font-semibold mb-4">
                  Component Distribution
                </h3>
                {compEntries
                  .sort(([, a], [, b]) => b - a)
                  .map(([ctype, count]) => (
                    <HBar
                      key={ctype}
                      label={COMPONENT_LABELS[ctype] ?? ctype}
                      value={count}
                      max={maxComp}
                      color={COMPONENT_COLORS[ctype] ?? '#4A90D9'}
                    />
                  ))}
              </div>

              {/* Region popularity */}
              <div className="bg-slate-900 border border-slate-700 rounded-2xl px-6 py-5 space-y-3">
                <h3 className="text-slate-400 text-xs uppercase tracking-widest font-semibold mb-4">
                  Region Adoption
                </h3>
                {regionEntries
                  .sort(([, a], [, b]) => b - a)
                  .map(([rid, count]) => (
                    <HBar
                      key={rid}
                      label={REGION_LABELS[rid] ?? rid}
                      value={count}
                      max={maxRegion}
                      color={REGIONS[rid as RegionId]?.color ?? '#4A90D9'}
                    />
                  ))}
              </div>
            </div>
          </div>

          {/* ── RIGHT — Live events ── */}
          <div className="w-[30%] flex flex-col border-l border-slate-800 overflow-y-auto">
            <div className="px-6 pt-6 pb-3 shrink-0">
              <h2 className="text-slate-400 text-xs uppercase tracking-[0.2em] font-semibold">
                Live Events
              </h2>
            </div>

            <div className="flex-1 px-4 pb-6 space-y-6">
              {/* Active attacks */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-2">
                  <span className="text-red-500 text-base">⚔</span>
                  <span className="text-slate-400 text-xs uppercase tracking-widest font-semibold">
                    Active Attacks
                  </span>
                  {stats.activeAttacks.length > 0 && (
                    <span className="ml-auto text-red-400 font-bold text-sm">
                      {stats.activeAttacks.length}
                    </span>
                  )}
                </div>

                <AnimatePresence mode="popLayout">
                  {stats.activeAttacks.length > 0
                    ? stats.activeAttacks.map(a => (
                        <ActiveAttackCard key={a.id} attack={a} />
                      ))
                    : (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-slate-700 text-center py-6 text-base rounded-xl border border-slate-800"
                      >
                        No active attacks 🕊
                      </motion.div>
                    )
                  }
                </AnimatePresence>
              </div>

              {/* Attack history */}
              <div className="bg-slate-900 border border-slate-700 rounded-2xl px-5 py-4 space-y-1">
                <h3 className="text-slate-500 text-xs uppercase tracking-widest font-semibold mb-3">
                  Recent History
                </h3>
                {stats.recentAttacks.length > 0
                  ? stats.recentAttacks.map(a => (
                      <RecentAttackRow key={a.id} attack={a} />
                    ))
                  : <div className="text-slate-700 text-sm py-2">No attacks recorded yet</div>
                }
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <footer className="shrink-0 border-t border-slate-800 px-8 py-2 flex items-center justify-between">
          <span className="text-slate-700 text-xs">
            HiveNet Cloud Clicker · Internal Dashboard
          </span>
          <span className="text-slate-700 text-xs font-mono">
            Last updated: {new Date(lastRefresh).toLocaleTimeString('en-GB')}
          </span>
        </footer>
      </div>
    </div>
  );
}

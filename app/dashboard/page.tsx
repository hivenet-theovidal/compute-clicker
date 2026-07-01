'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type {
  DashboardStats,
  ActiveAttackEntry,
  RecentAttackEntry,
  LeaderboardEntry,
} from '@/lib/db';
import { formatEuros, REGIONS, type RegionId, type ComponentType } from '@/lib/game-engine';
import GameBackground from '@/components/GameBackground';
import { COMPONENT_META } from '@/components/UpgradeNode';

const REFRESH_MS = 5000;

const COMPONENT_LABELS: Record<string, string> = {
  cpu: 'CPU', ram: 'RAM', gpu: 'GPU',
  power: 'Power', bandwidth: 'Bandwidth', container: 'Container',
};
const REGION_LABELS: Record<string, string> = {
  uae: 'UAE', eu: 'Europe', us: 'United States', sea: 'SE Asia', brazil: 'Brazil',
};
const compColor = (c: string) => COMPONENT_META[c as ComponentType]?.color ?? '#57b0ff';

const ACCENT = '#ffb257';
const INFO = '#93b4ff';

// ── Helpers ───────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function countdown(expiresAt: number): string {
  const ms = Math.max(0, expiresAt - Date.now());
  const s = Math.ceil(ms / 1000);
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] uppercase tracking-[0.25em] font-bold text-dim">{children}</h2>
  );
}

function KpiTile({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color: string;
}) {
  return (
    <div
      className="glass rounded-2xl px-5 py-3 flex flex-col gap-0.5"
      style={{ boxShadow: `inset 0 1px 0 var(--gray-a5), inset 0 0 40px -22px ${color}, 0 24px 60px -34px rgba(0,0,0,0.9)` }}
    >
      <div className="text-dim text-[10px] uppercase tracking-[0.2em]">{label}</div>
      <div className="text-2xl font-black tabular-nums" style={{ color, textShadow: `0 0 26px ${color}66` }}>{value}</div>
      {sub && <div className="text-faint text-[11px]">{sub}</div>}
    </div>
  );
}

function HBar({ label, value, max, color }: {
  label: string; value: number; max: number; color: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-20 text-muted text-xs text-right shrink-0">{label}</div>
      <div className="relative flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--gray-a3)' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}, ${color}bb)`, boxShadow: `0 0 12px -2px ${color}` }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      <div className="w-14 text-right text-xs font-mono font-bold tabular-nums" style={{ color }}>
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
  const top = rank <= 3;
  const nameColor = rank === 1 ? ACCENT : top ? 'var(--gray-12)' : 'var(--gray-11)';
  const barColor = rank === 1 ? '#ff9a33' : INFO;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="flex items-center gap-3 px-3 py-2.5 rounded-2xl"
      style={top ? { background: 'var(--gray-a2)', boxShadow: `inset 0 0 0 1px var(--gray-a4)` } : undefined}
    >
      <div className="w-8 text-center shrink-0 text-lg">
        {medal ?? <span className="font-bold text-faint">{rank}</span>}
      </div>
      <div className="flex-1 min-w-0">
        <div
          className={`font-bold truncate ${rank === 1 ? 'text-xl' : top ? 'text-lg' : 'text-base'}`}
          style={{ color: nameColor, textShadow: rank === 1 ? `0 0 22px ${ACCENT}55` : undefined }}
        >
          {entry.name}
        </div>
        <div className="mt-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--gray-a3)' }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: barColor, boxShadow: `0 0 10px -1px ${barColor}` }}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.7, delay: rank * 0.04 }}
          />
        </div>
      </div>
      <div
        className={`font-mono tabular-nums font-bold shrink-0 ${rank === 1 ? 'text-xl' : top ? 'text-lg' : 'text-base'}`}
        style={{ color: rank === 1 ? ACCENT : top ? 'var(--gray-12)' : 'var(--gray-11)' }}
      >
        {formatEuros(entry.total_earned)}
      </div>
    </motion.div>
  );
}

function ActiveAttackCard({ attack }: { attack: ActiveAttackEntry }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const ms = Math.max(0, attack.expires_at - Date.now());
  const totalMs = attack.expires_at - attack.created_at;
  const pct = totalMs > 0 ? (ms / totalMs) * 100 : 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="glass rounded-2xl px-4 py-3 space-y-2"
      style={{ boxShadow: 'inset 0 0 0 1px #ff5a5a33, inset 0 0 40px -20px #ff3b3b, 0 20px 50px -30px #000' }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg shrink-0" style={{ color: '#ff6b6b' }}>⚔</span>
          <span className="text-fg font-semibold text-base truncate">{attack.attacker_name}</span>
          <span className="text-faint text-sm shrink-0">→</span>
          <span className="font-semibold text-base truncate" style={{ color: '#ff8a8a' }}>{attack.target_name}</span>
        </div>
        <div className="font-mono text-base font-bold shrink-0" style={{ color: '#ff8a8a' }}>{countdown(attack.expires_at)}</div>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#ff5a5a22' }}>
        <motion.div className="h-full rounded-full" style={{ background: '#ff5a5a', boxShadow: '0 0 10px #ff3b3b' }} animate={{ width: `${pct}%` }} transition={{ duration: 0.9, ease: 'linear' }} />
      </div>
      <div className="text-xs" style={{ color: '#ff8a8a99' }}>−30% income on target</div>
    </motion.div>
  );
}

function RecentAttackRow({ attack }: { attack: RecentAttackEntry }) {
  const active = attack.expires_at > Date.now();
  return (
    <div className="flex items-center gap-3 text-sm py-1" style={{ color: active ? '#ff8a8a' : 'var(--gray-10)' }}>
      <span className="shrink-0">{active ? '⚔' : '·'}</span>
      <span className="font-semibold truncate max-w-[7rem]">{attack.attacker_name}</span>
      <span className="text-faint">→</span>
      <span className="truncate max-w-[7rem]">{attack.target_name}</span>
      <span className="ml-auto shrink-0 text-xs tabular-nums text-faint">{timeAgo(attack.created_at)}</span>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [lastRefresh, setLastRefresh] = useState<number>(Date.now());
  const [refreshIn, setRefreshIn] = useState(REFRESH_MS);
  const clock = useClock();

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/dashboard');
      const data: DashboardStats = await res.json();
      setStats(data);
      setLastRefresh(Date.now());
      setRefreshIn(REFRESH_MS);
    } catch { /* silent */ }
  };

  useEffect(() => {
    fetchStats();
    const id = setInterval(fetchStats, REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setRefreshIn((r) => Math.max(0, r - 200)), 200);
    return () => clearInterval(id);
  }, [lastRefresh]);

  if (!stats) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#04060d' }}>
        <div className="text-dim text-sm animate-pulse uppercase tracking-widest">Syncing global grid…</div>
      </div>
    );
  }

  const topEarned = stats.topPlayers[0]?.total_earned ?? 1;
  const compEntries = Object.entries(stats.componentTotals) as [string, number][];
  const maxComp = Math.max(...compEntries.map(([, v]) => v), 1);
  const regionEntries = Object.entries(stats.regionUnlocks) as [string, number][];
  const maxRegion = Math.max(...regionEntries.map(([, v]) => v), 1);

  return (
    <div className="relative min-h-screen text-fg">
      <GameBackground />

      <div className="relative flex flex-col h-screen">
        {/* ── Header ── */}
        <header className="flex items-center justify-between px-8 py-4 shrink-0" style={{ borderBottom: '1px solid var(--gray-a3)' }}>
          <div className="flex items-center gap-3">
            <span className="grid place-items-center rounded-xl text-lg" style={{ width: 34, height: 34, background: 'linear-gradient(140deg,#ff9a33,#f36f14)', boxShadow: '0 0 18px -4px #ff9a33' }}>🛰️</span>
            <span className="font-black text-2xl tracking-tight glow-orange" style={{ color: ACCENT }}>HiveNet</span>
            <span className="text-faint text-lg">·</span>
            <span className="text-muted text-lg font-semibold uppercase tracking-[0.2em]">Global Grid</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-24 h-1 rounded-full overflow-hidden" style={{ background: 'var(--gray-a3)' }}>
                <motion.div className="h-full rounded-full" style={{ background: INFO, boxShadow: `0 0 8px ${INFO}` }} animate={{ width: `${(refreshIn / REFRESH_MS) * 100}%` }} transition={{ duration: 0.2 }} />
              </div>
              <span className="text-faint text-[10px] uppercase tracking-[0.2em]">Live</span>
            </div>
            <div className="text-muted font-mono text-xl tabular-nums">{clock}</div>
          </div>
        </header>

        {/* ── 3-column grid ── */}
        <div className="flex flex-1 overflow-hidden">
          {/* LEFT — Leaderboard */}
          <div className="w-[32%] flex flex-col overflow-y-auto" style={{ borderRight: '1px solid var(--gray-a3)' }}>
            <div className="px-6 pt-6 pb-3 shrink-0"><SectionTitle>Global Leaderboard</SectionTitle></div>
            <div className="flex-1 px-4 pb-6 space-y-1">
              <AnimatePresence mode="popLayout">
                {stats.topPlayers.map((entry, i) => (
                  <LeaderboardRow key={entry.player_id} entry={entry} rank={i + 1} max={topEarned} />
                ))}
              </AnimatePresence>
              {stats.topPlayers.length === 0 && (
                <div className="text-faint text-center py-12 text-lg">No players yet</div>
              )}
            </div>
          </div>

          {/* CENTER — Global stats */}
          <div className="flex-1 flex flex-col overflow-y-auto">
            <div className="px-6 pt-5 pb-2 shrink-0"><SectionTitle>Global Statistics</SectionTitle></div>
            <div className="px-6 pb-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <KpiTile label="Active Players" value={stats.playerCount.toString()} color={INFO} />
                <KpiTile label="Global Total Earned" value={formatEuros(stats.globalTotalEarned)} color={ACCENT} />
                <KpiTile
                  label="Live Attacks"
                  value={stats.activeAttacks.length.toString()}
                  sub={stats.activeAttacks.length > 0 ? 'players under attack' : 'all clear'}
                  color={stats.activeAttacks.length > 0 ? '#ff6b6b' : '#43d6b5'}
                />
                <KpiTile
                  label="Total Components"
                  value={Object.values(stats.componentTotals).reduce((a, b) => a + b, 0).toLocaleString()}
                  sub="across all regions"
                  color="#b06bff"
                />
              </div>

              <div className="glass rounded-2xl px-5 py-4 space-y-2">
                <h3 className="mb-3"><SectionTitle>Component Distribution</SectionTitle></h3>
                {compEntries
                  .sort(([, a], [, b]) => b - a)
                  .map(([ctype, count]) => (
                    <HBar key={ctype} label={COMPONENT_LABELS[ctype] ?? ctype} value={count} max={maxComp} color={compColor(ctype)} />
                  ))}
              </div>

              <div className="glass rounded-2xl px-5 py-4 space-y-2">
                <h3 className="mb-3"><SectionTitle>Region Adoption</SectionTitle></h3>
                {regionEntries
                  .sort(([, a], [, b]) => b - a)
                  .map(([rid, count]) => (
                    <HBar key={rid} label={REGION_LABELS[rid] ?? rid} value={count} max={maxRegion} color={REGIONS[rid as RegionId]?.color ?? INFO} />
                  ))}
              </div>
            </div>
          </div>

          {/* RIGHT — Live events */}
          <div className="w-[30%] flex flex-col overflow-y-auto" style={{ borderLeft: '1px solid var(--gray-a3)' }}>
            <div className="px-6 pt-6 pb-3 shrink-0"><SectionTitle>Live Events</SectionTitle></div>
            <div className="flex-1 px-4 pb-6 space-y-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-2">
                  <span className="text-base" style={{ color: '#ff6b6b' }}>⚔</span>
                  <SectionTitle>Active Attacks</SectionTitle>
                  {stats.activeAttacks.length > 0 && (
                    <span className="ml-auto font-bold text-sm" style={{ color: '#ff8a8a' }}>{stats.activeAttacks.length}</span>
                  )}
                </div>
                <AnimatePresence mode="popLayout">
                  {stats.activeAttacks.length > 0 ? (
                    stats.activeAttacks.map((a) => <ActiveAttackCard key={a.id} attack={a} />)
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="glass text-faint text-center py-6 text-base rounded-2xl"
                    >
                      No active attacks 🕊
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="glass rounded-2xl px-5 py-4 space-y-1">
                <h3 className="mb-3"><SectionTitle>Recent History</SectionTitle></h3>
                {stats.recentAttacks.length > 0
                  ? stats.recentAttacks.map((a) => <RecentAttackRow key={a.id} attack={a} />)
                  : <div className="text-faint text-sm py-2">No attacks recorded yet</div>}
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <footer className="shrink-0 px-8 py-2 flex items-center justify-between" style={{ borderTop: '1px solid var(--gray-a3)' }}>
          <span className="text-faint text-xs">HiveNet Cloud Empire · Global Grid</span>
          <span className="text-faint text-xs font-mono">Last sync: {new Date(lastRefresh).toLocaleTimeString('en-GB')}</span>
        </footer>
      </div>
    </div>
  );
}

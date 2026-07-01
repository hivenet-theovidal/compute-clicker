'use client';

import { useState } from 'react';
import useSWR from 'swr';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { formatEuros } from '@/lib/game-engine';

interface LeaderboardEntry {
  player_id: string;
  name: string;
  total_earned: number;
}
interface AttacksData {
  myCooldowns: Record<string, number>;
}
const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Props {
  playerName: string;
  playerId: string;
  playerTotal: number;
  playerBalance: number;
  onAttackLaunched?: () => void;
}

const MEDALS = ['🥇', '🥈', '🥉'];

function attackCost(playerTotal: number, targetTotal: number): number {
  return Math.max(10, (playerTotal + targetTotal) * 0.005);
}

export default function LeaderboardWindow({ playerName, playerId, playerTotal, playerBalance, onAttackLaunched }: Props) {
  const [open, setOpen] = useState(true);
  const { data } = useSWR<{ leaderboard: LeaderboardEntry[] }>('/api/leaderboard', fetcher, { refreshInterval: 5000 });
  const { data: attacksData, mutate: mutateAttacks } = useSWR<AttacksData>('/api/attacks', fetcher, { refreshInterval: 5000 });

  const [confirmTarget, setConfirmTarget] = useState<{ id: string; name: string; cost: number } | null>(null);
  const [attacking, setAttacking] = useState(false);

  const myCooldowns = attacksData?.myCooldowns ?? {};
  const entries = data?.leaderboard ?? [];
  const merged = entries.map((e) =>
    e.player_id === playerId || e.name === playerName ? { ...e, total_earned: Math.max(e.total_earned, playerTotal) } : e,
  );
  const top = merged.slice(0, 6);

  async function confirmAttack() {
    if (!confirmTarget || attacking) return;
    setAttacking(true);
    try {
      const res = await fetch('/api/attack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId: confirmTarget.id }),
      });
      if (res.ok) {
        mutateAttacks();
        onAttackLaunched?.();
      }
    } finally {
      setAttacking(false);
      setConfirmTarget(null);
    }
  }

  // NB: a plain function called inline (not a nested <Component/>), so the button
  // isn't remounted on every 100ms re-render — which was eating clicks.
  const renderAttackButton = (entry: LeaderboardEntry) => {
    const isSelf = entry.player_id === playerId || entry.name === playerName;
    if (isSelf) return null;
    const cost = attackCost(playerTotal, entry.total_earned);
    const now = Date.now();
    const cdExpires = myCooldowns[entry.player_id];
    const onCooldown = cdExpires !== undefined && cdExpires > now;
    const canAfford = playerBalance >= cost;

    if (onCooldown) {
      const s = Math.ceil((cdExpires - now) / 1000);
      return <span title={`${s}s cooldown`} className="text-[10px] text-faint tabular-nums">⏳{s}s</span>;
    }
    return (
      <button
        onClick={() => canAfford && setConfirmTarget({ id: entry.player_id, name: entry.name, cost })}
        disabled={!canAfford}
        title={canAfford ? `Sabotage for ${formatEuros(cost)}` : `Need ${formatEuros(cost)}`}
        className="text-sm transition-transform hover:scale-125 disabled:opacity-30 disabled:hover:scale-100"
      >
        ⚔️
      </button>
    );
  };

  return (
    <div className="glass rounded-2xl w-64 overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-4 py-2.5">
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-fg">
          <span className="text-sm">🏆</span> Top Empires
        </span>
        <motion.span animate={{ rotate: open ? 0 : -90 }} className="text-dim text-xs">▾</motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="px-2.5 pb-2.5 space-y-0.5">
              {top.length === 0 && <p className="py-4 text-center text-xs text-faint">Scanning the network…</p>}
              {top.map((entry, i) => {
                const isPlayer = entry.player_id === playerId || entry.name === playerName;
                return (
                  <div
                    key={entry.player_id ?? i}
                    className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs"
                    style={
                      isPlayer
                        ? { background: 'color-mix(in oklab, var(--orange-9) 14%, transparent)', boxShadow: 'inset 0 0 0 1px color-mix(in oklab, var(--orange-9) 40%, transparent)' }
                        : undefined
                    }
                  >
                    <span className="w-5 text-center">
                      {i < 3 ? MEDALS[i] : <span className="text-faint font-bold">{i + 1}</span>}
                    </span>
                    <span className={`flex-1 truncate font-semibold ${isPlayer ? 'text-accent-fg' : 'text-muted'}`}>
                      {entry.name}
                    </span>
                    <span className="font-mono tabular-nums text-info-fg">{formatEuros(entry.total_earned)}</span>
                    <span className="w-6 text-right">{renderAttackButton(entry)}</span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sabotage confirmation */}
      <Dialog.Root open={!!confirmTarget} onOpenChange={(o) => { if (!o) setConfirmTarget(null); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
          <Dialog.Content className="glass fixed left-1/2 top-1/2 z-50 w-80 -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6 focus:outline-none" style={{ boxShadow: '0 0 0 1px #ff5a5a44, 0 0 50px -12px #ff3b3b, inset 0 1px 0 var(--gray-a5)' }}>
            <Dialog.Title className="mb-1 flex items-center gap-2 text-base font-bold text-fg">
              <span>⚔️</span> Launch sabotage?
            </Dialog.Title>
            <Dialog.Description className="mb-5 text-sm text-muted">
              Strike <span className="font-semibold" style={{ color: '#ff8a8a' }}>{confirmTarget?.name}</span> for{' '}
              <span className="font-mono text-accent-fg">{confirmTarget ? formatEuros(confirmTarget.cost) : ''}</span> — their income drops 30% for 90s.
            </Dialog.Description>
            <div className="flex gap-3">
              <button
                onClick={confirmAttack}
                disabled={attacking}
                className="flex-1 rounded-xl py-2 text-sm font-bold text-white transition-transform hover:scale-[1.02] disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #ff5a5a, #c81e1e)', boxShadow: '0 0 24px -6px #ff3b3b' }}
              >
                {attacking ? 'Launching…' : '⚔️ Attack'}
              </button>
              <Dialog.Close asChild>
                <button className="flex-1 rounded-xl py-2 text-sm font-semibold text-muted" style={{ background: 'var(--gray-a3)' }}>Cancel</button>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

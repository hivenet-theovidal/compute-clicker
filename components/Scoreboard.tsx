'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
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
  playerTotal: number;
  playerBalance: number;
  playerId: string;
  onAttackLaunched?: () => void;
}

export default function Scoreboard({ playerName, playerTotal, playerBalance, onAttackLaunched }: Props) {
  const { data } = useSWR<{ leaderboard: LeaderboardEntry[] }>(
    '/api/leaderboard',
    fetcher,
    { refreshInterval: 5000 }
  );

  const { data: attacksData, mutate: mutateAttacks } = useSWR<AttacksData>(
    '/api/attacks',
    fetcher,
    { refreshInterval: 5000 }
  );

  const [confirmTarget, setConfirmTarget] = useState<{ id: string; name: string; cost: number } | null>(null);
  const [attacking, setAttacking] = useState(false);

  const entries = data?.leaderboard ?? [];
  const myCooldowns = attacksData?.myCooldowns ?? {};

  const merged = entries.map((e) =>
    e.name === playerName ? { ...e, total_earned: Math.max(e.total_earned, playerTotal) } : e
  );

  const top10 = merged.slice(0, 10);
  const playerRank = merged.findIndex((e) => e.name === playerName);

  function attackCost(targetTotal: number): number {
    return Math.max(10, (playerTotal + targetTotal) * 0.005);
  }

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

  function renderAttackButton(entry: LeaderboardEntry) {
    if (entry.name === playerName) return null;

    const cost = attackCost(entry.total_earned);
    const cooldownExpires = myCooldowns[entry.player_id];
    const now = Date.now();
    const onCooldown = cooldownExpires !== undefined && cooldownExpires > now;
    const canAfford = playerBalance >= cost;

    if (onCooldown) {
      const secsLeft = Math.ceil((cooldownExpires - now) / 1000);
      return (
        <button
          disabled
          title={`${secsLeft}s remaining`}
          className="ml-1 text-slate-600 text-xs cursor-not-allowed opacity-40"
        >
          ⚔️
        </button>
      );
    }

    if (!canAfford) {
      return (
        <button
          disabled
          title={`Cost: ${formatEuros(cost)}`}
          className="ml-1 text-slate-600 text-xs cursor-not-allowed opacity-40"
        >
          ⚔️
        </button>
      );
    }

    return (
      <button
        onClick={() => setConfirmTarget({ id: entry.player_id, name: entry.name, cost })}
        title={`Attack for ${formatEuros(cost)}`}
        className="ml-1 text-yellow-400 hover:text-red-400 text-xs transition-colors"
      >
        ⚔️
      </button>
    );
  }

  return (
    <div className="w-full bg-surface/90 border border-line-2 rounded-2xl p-4 shadow-2xl backdrop-blur">
      <h2 className="text-muted text-xs font-semibold uppercase tracking-widest mb-3 text-center">
        Leaderboard
      </h2>

      <div className="space-y-1">
        <AnimatePresence mode="popLayout">
          {top10.map((entry, i) => {
            const isPlayer = entry.name === playerName;
            return (
              <motion.div
                key={i}
                layout
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
                className={`
                  flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs
                  ${isPlayer ? 'bg-accent/10 border border-accent/30' : 'hover:bg-surface-2/50'}
                `}
              >
                <span className={`w-5 text-center font-bold ${i === 0 ? 'text-accent-fg' : i === 1 ? 'text-muted' : i === 2 ? 'text-accent' : 'text-faint'}`}>
                  {i + 1}
                </span>
                <span className={`flex-1 truncate ${isPlayer ? 'text-accent-fg font-semibold' : 'text-muted'}`}>
                  {entry.name}
                </span>
                <span className="text-info-fg font-mono tabular-nums">
                  {formatEuros(entry.total_earned)}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Show player if outside top 10 */}
        {playerRank >= 10 && (
          <>
            <div className="text-faint text-center text-xs py-1">···</div>
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs bg-accent/10 border border-accent/30">
              <span className="w-5 text-center font-bold text-dim">{playerRank + 1}</span>
              <span className="flex-1 truncate text-accent-fg font-semibold">{playerName}</span>
              <span className="text-info-fg font-mono tabular-nums">{formatEuros(playerTotal)}</span>
            </div>
          </>
        )}

        {entries.length === 0 && (
          <p className="text-faint text-center text-xs py-4">Loading…</p>
        )}
      </div>

      {/* Attack confirmation dialog */}
      <Dialog.Root open={!!confirmTarget} onOpenChange={(open) => { if (!open) setConfirmTarget(null); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-80 bg-slate-900 border border-red-500/40 rounded-2xl p-6 shadow-2xl focus:outline-none">
            <Dialog.Title className="text-white font-semibold text-base mb-1">
              Launch sabotage?
            </Dialog.Title>
            <Dialog.Description className="text-slate-400 text-sm mb-5">
              Attack{' '}
              <span className="text-red-400 font-semibold">{confirmTarget?.name}</span>{' '}
              for{' '}
              <span className="text-yellow-400 font-mono">{confirmTarget ? formatEuros(confirmTarget.cost) : ''}</span>
              {' '}— their income drops by 30% for 90 seconds.
            </Dialog.Description>

            <div className="flex gap-3">
              <button
                onClick={confirmAttack}
                disabled={attacking}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-xl transition-colors"
              >
                {attacking ? 'Attacking…' : '⚔️ Attack'}
              </button>
              <Dialog.Close asChild>
                <button className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-semibold py-2 rounded-xl transition-colors">
                  Cancel
                </button>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

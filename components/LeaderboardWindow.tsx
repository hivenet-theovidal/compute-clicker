'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { AnimatePresence, motion } from 'framer-motion';
import { formatEuros } from '@/lib/game-engine';

interface LeaderboardEntry {
  name: string;
  total_earned: number;
}
const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Props {
  playerName: string;
  playerTotal: number;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export default function LeaderboardWindow({ playerName, playerTotal }: Props) {
  const [open, setOpen] = useState(true);
  const { data } = useSWR<{ leaderboard: LeaderboardEntry[] }>('/api/leaderboard', fetcher);

  const entries = data?.leaderboard ?? [];
  const merged = entries.map((e) =>
    e.name === playerName ? { ...e, total_earned: Math.max(e.total_earned, playerTotal) } : e,
  );
  const top = merged.slice(0, 6);

  return (
    <div className="glass rounded-2xl w-60 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-2.5"
      >
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
              {top.length === 0 && (
                <p className="py-4 text-center text-xs text-faint">Scanning the network…</p>
              )}
              {top.map((entry, i) => {
                const isPlayer = entry.name === playerName;
                return (
                  <div
                    key={i}
                    className="relative flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs"
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
                    <span className="font-mono tabular-nums text-info-fg">
                      {formatEuros(entry.total_earned)}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

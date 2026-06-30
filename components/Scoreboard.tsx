'use client';

import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
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

export default function Scoreboard({ playerName, playerTotal }: Props) {
  const { data } = useSWR<{ leaderboard: LeaderboardEntry[] }>(
    '/api/leaderboard',
    fetcher,
    { refreshInterval: 5000 }
  );

  const entries = data?.leaderboard ?? [];

  // Merge live player data into the display list
  const merged = entries.map((e) =>
    e.name === playerName ? { ...e, total_earned: Math.max(e.total_earned, playerTotal) } : e
  );

  const top10 = merged.slice(0, 10);
  const playerRank = merged.findIndex((e) => e.name === playerName);

  return (
    <div className="w-64 bg-slate-900/90 border border-slate-700 rounded-2xl p-4 shadow-2xl backdrop-blur">
      <h2 className="text-slate-300 text-xs font-semibold uppercase tracking-widest mb-3 text-center">
        Leaderboard
      </h2>

      <div className="space-y-1">
        <AnimatePresence mode="popLayout">
          {top10.map((entry, i) => {
            const isPlayer = entry.name === playerName;
            return (
              <motion.div
                key={entry.name}
                layout
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
                className={`
                  flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs
                  ${isPlayer ? 'bg-yellow-400/10 border border-yellow-400/30' : 'hover:bg-slate-800/50'}
                `}
              >
                <span className={`w-5 text-center font-bold ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-orange-400' : 'text-slate-600'}`}>
                  {i + 1}
                </span>
                <span className={`flex-1 truncate ${isPlayer ? 'text-yellow-300 font-semibold' : 'text-slate-300'}`}>
                  {entry.name}
                </span>
                <span className="text-green-400 font-mono tabular-nums">
                  {formatEuros(entry.total_earned)}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Show player if outside top 10 */}
        {playerRank >= 10 && (
          <>
            <div className="text-slate-700 text-center text-xs py-1">···</div>
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs bg-yellow-400/10 border border-yellow-400/30">
              <span className="w-5 text-center font-bold text-slate-500">{playerRank + 1}</span>
              <span className="flex-1 truncate text-yellow-300 font-semibold">{playerName}</span>
              <span className="text-green-400 font-mono tabular-nums">{formatEuros(playerTotal)}</span>
            </div>
          </>
        )}

        {entries.length === 0 && (
          <p className="text-slate-600 text-center text-xs py-4">Loading…</p>
        )}
      </div>
    </div>
  );
}

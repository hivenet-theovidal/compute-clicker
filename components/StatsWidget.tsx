'use client';

import { formatEuros } from '@/lib/game-engine';

interface Props {
  totalEarned: number;
  eps: number;
  clickValue: number;
}

function Stat({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="grid place-items-center rounded-lg text-sm"
        style={{ width: 28, height: 28, background: `${color}1f`, boxShadow: `inset 0 0 12px -4px ${color}` }}
      >
        {icon}
      </span>
      <div className="leading-tight">
        <div className="text-[9px] uppercase tracking-[0.15em] text-dim">{label}</div>
        <div className="font-mono text-xs font-semibold tabular-nums" style={{ color }}>
          {value}
        </div>
      </div>
    </div>
  );
}

/** Compact floating stats cluster (no dashboard panel). */
export default function StatsWidget({ totalEarned, eps, clickValue }: Props) {
  return (
    <div className="glass rounded-2xl px-4 py-3 flex flex-col gap-2.5">
      <Stat icon="🌐" label="Total empire" value={formatEuros(totalEarned)} color="#ffa23d" />
      <Stat icon="⚡" label="Income / s" value={`${formatEuros(eps)}`} color="#93b4ff" />
      <Stat icon="👆" label="Per deploy" value={formatEuros(clickValue)} color="#eeeef0" />
    </div>
  );
}

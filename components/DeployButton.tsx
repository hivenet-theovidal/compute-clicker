'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { formatEuros } from '@/lib/game-engine';

interface Props {
  clickValue: number;
  onCLick: (x: number, y: number) => void;
}

/** The big, satisfying "mine" button. */
export default function DeployButton({ clickValue, onCLick }: Props) {
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const rid = useState(() => ({ n: 0 }))[0];

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const id = ++rid.n;
      setRipples((r) => [...r, { id, x: e.clientX - rect.left, y: e.clientY - rect.top }]);
      setTimeout(() => setRipples((r) => r.filter((x) => x.id !== id)), 620);
      onCLick(e.clientX, e.clientY);
    },
    [onCLick, rid],
  );

  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={handleClick}
      aria-label="Deploy to earn"
      className="group relative flex items-center justify-center gap-4 rounded-full pl-9 pr-12 py-6 min-w-[360px] font-black text-black overflow-hidden"
      style={{
        background: 'radial-gradient(120% 120% at 30% 20%, #ffd07a, #ff9a33 45%, #f36f14 100%)',
        boxShadow: '0 0 40px -6px #ff9a3399, 0 14px 40px -12px #000, inset 0 2px 0 #ffe1b0, inset 0 -6px 14px -6px #c24e00',
      }}
    >
      {/* idle glow ring */}
      <span className="glow-pulse pointer-events-none absolute -inset-1 rounded-full" style={{ boxShadow: '0 0 40px 6px #ff9a3355' }} />
      {/* sheen */}
      <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
        <span className="sheen absolute top-0 left-0 h-full w-1/3" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.65), transparent)' }} />
      </span>

      <span
        className="grid place-items-center rounded-full"
        style={{ width: 56, height: 56, background: 'rgba(0,0,0,0.18)', boxShadow: 'inset 0 0 12px rgba(0,0,0,0.35)' }}
      >
        <img
          src="/images/zap.png"
          alt=""
          width={40}
          height={40}
          draggable={false}
          className="object-contain"
          style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.45))' }}
        />
      </span>
      <span className="relative flex flex-col items-start leading-none">
        <span className="text-3xl tracking-wider">DEPLOY</span>
        <span className="text-sm font-bold opacity-80">+{formatEuros(clickValue)} / tap</span>
      </span>

      {ripples.map((r) => (
        <motion.span
          key={r.id}
          initial={{ width: 0, height: 0, opacity: 0.55, x: r.x, y: r.y }}
          animate={{ width: 420, height: 420, opacity: 0, x: r.x - 210, y: r.y - 210 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="pointer-events-none absolute rounded-full bg-white"
        />
      ))}
    </motion.button>
  );
}

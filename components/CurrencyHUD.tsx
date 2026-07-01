'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { formatEuros } from '@/lib/game-engine';
import { numFont } from '@/lib/fonts';

interface Props {
  balance: number;
  eps: number;
}

const goldStyle: CSSProperties = {
  background: 'linear-gradient(180deg, #fff3d6 0%, #ffc879 45%, #ffb257 60%, #e0820f 100%)',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
  WebkitTextFillColor: 'transparent',
};

/** Balance as whole euros — no fast-churning decimals fighting the odometer. */
function formatBalance(v: number): string {
  if (v >= 1000) return formatEuros(v).slice(1); // 2.32K, 1.03M …
  return Math.floor(v).toLocaleString('en-US');  // 0 … 999
}

/** A single odometer digit slot — rolls the new digit in from the top. */
function RollDigit({ ch }: { ch: string }) {
  return (
    <span className="relative inline-block overflow-hidden" style={{ height: '1em', width: '1ch', lineHeight: 1 }}>
      <AnimatePresence initial={false}>
        <motion.span
          key={ch}
          className="absolute inset-0 flex items-center justify-center"
          initial={{ y: '-115%' }}
          animate={{ y: '0%' }}
          exit={{ y: '115%' }}
          transition={{ duration: 0.32, ease: [0.32, 0.9, 0.36, 1] }}
          style={goldStyle}
        >
          {ch}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** Renders a formatted amount as rolling digits + static separators/suffixes. */
function Ticker({ text, className }: { text: string; className?: string }) {
  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'flex-end', filter: 'drop-shadow(0 2px 12px rgba(255,154,51,0.45)) drop-shadow(0 0 26px rgba(255,154,51,0.25))' }}
    >
      {text.split('').map((ch, i) =>
        /\d/.test(ch) ? (
          <RollDigit key={i} ch={ch} />
        ) : (
          <span key={i} style={{ ...goldStyle, padding: ch === '.' ? '0 0.01em' : '0 0.03em' }}>
            {ch}
          </span>
        ),
      )}
    </span>
  );
}

/** Huge, animated, always-rolling money counter — the emotional centre. */
export default function CurrencyHUD({ balance, eps }: Props) {
  const [sparks, setSparks] = useState<{ id: number; dx: number; dy: number }[]>([]);
  const [coinKey, setCoinKey] = useState(0);
  const prevEps = useRef(eps);
  const sparkId = useRef(0);

  // Sparkle burst + coin flip whenever income jumps (a purchase, a new region…).
  useEffect(() => {
    if (eps > prevEps.current * 1.02 + 0.001) {
      setCoinKey((k) => k + 1);
      const burst = Array.from({ length: 10 }, () => {
        const a = Math.random() * Math.PI * 2;
        const d = 30 + Math.random() * 46;
        return { id: sparkId.current++, dx: Math.cos(a) * d, dy: Math.sin(a) * d };
      });
      setSparks((s) => [...s, ...burst]);
      const ids = burst.map((b) => b.id);
      setTimeout(() => setSparks((s) => s.filter((x) => !ids.includes(x.id))), 650);
    }
    prevEps.current = eps;
  }, [eps]);

  const numText = formatBalance(balance);

  return (
    <div className="relative flex flex-col items-center select-none">
      {/* sparkles */}
      <div className="pointer-events-none absolute left-1/2 top-9">
        {sparks.map((s) => (
          <span
            key={s.id}
            className="spark absolute h-1.5 w-1.5 rounded-full"
            style={{ ['--dx' as string]: `${s.dx}px`, ['--dy' as string]: `${s.dy}px`, background: '#ffcf8a', boxShadow: '0 0 8px #ffb04d' }}
          />
        ))}
      </div>

      {/* label pill */}
      {/* <div
        className="mb-2 rounded-full px-3 py-0.5 text-[9px] font-bold uppercase tracking-[0.35em]"
        style={{ color: '#ffcf87', background: 'rgba(255,154,51,0.08)', boxShadow: 'inset 0 0 0 1px rgba(255,154,51,0.22)' }}
      >
        Balance
      </div> */}

      {/* coin + rolling gold balance */}
      <div className="flex items-center gap-3" style={{ perspective: 420 }}>
        <Ticker text={numText} className={`${numFont.className} text-[51px] md:text-[61px] font-black tabular-nums leading-none`} />
      </div>

      {/* passive income — playful badge */}
      <div
        className="mt-2.5 flex items-center gap-2 rounded-full pl-1.5 pr-3 py-1"
        style={{
          background: 'linear-gradient(90deg, rgba(87,130,255,0.24), rgba(87,130,255,0.05))',
          boxShadow: 'inset 0 0 0 1px rgba(87,130,255,0.38), 0 0 20px -6px rgba(87,130,255,0.6)',
        }}
      >
        <span
          className="glow-pulse grid place-items-center rounded-full text-xs"
          style={{ width: 22, height: 22, background: 'radial-gradient(circle at 35% 30%, #bcd0ff, #4f7dff)', boxShadow: '0 0 10px -2px #6b93ff' }}
        >
          ⚡
        </span>
        <span className="glow-blue font-black tabular-nums text-sm" style={{ color: '#aecaff' }}>+{formatEuros(eps)}/s</span>
        <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-faint">passive</span>
      </div>
    </div>
  );
}

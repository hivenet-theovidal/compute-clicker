'use client';

import { useEffect, useRef, useState } from 'react';
import { formatEuros } from '@/lib/game-engine';

interface Props {
  balance: number;
  eps: number;
}

/** Huge, animated, always-rolling money counter — the emotional centre. */
export default function CurrencyHUD({ balance, eps }: Props) {
  const targetRef = useRef(balance);
  targetRef.current = balance;
  const [disp, setDisp] = useState(balance);
  const [sparks, setSparks] = useState<{ id: number; dx: number; dy: number }[]>([]);
  const prevEps = useRef(eps);
  const sparkId = useRef(0);

  // Smoothly chase the real balance for that "counting up" feel.
  useEffect(() => {
    let raf = 0;
    let cur = balance;
    const loop = () => {
      cur += (targetRef.current - cur) * 0.14;
      if (Math.abs(targetRef.current - cur) < 0.01) cur = targetRef.current;
      setDisp(cur);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sparkle burst whenever income jumps (a purchase, a new region…).
  useEffect(() => {
    if (eps > prevEps.current * 1.02 + 0.001) {
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

  return (
    <div className="relative flex flex-col items-center select-none">
      {/* sparkles */}
      <div className="pointer-events-none absolute left-1/2 top-7">
        {sparks.map((s) => (
          <span
            key={s.id}
            className="spark absolute h-1.5 w-1.5 rounded-full"
            style={{ ['--dx' as string]: `${s.dx}px`, ['--dy' as string]: `${s.dy}px`, background: '#ffcf8a', boxShadow: '0 0 8px #ffb04d' }}
          />
        ))}
      </div>

      <div className="text-[10px] font-semibold uppercase tracking-[0.4em] text-dim mb-1">Empire balance</div>
      <div
        key={Math.floor(disp / 25)}
        className="num-pop text-6xl md:text-7xl font-black tabular-nums glow-orange leading-none"
        style={{ color: '#ffb257', letterSpacing: '-0.03em' }}
      >
        {formatEuros(disp)}
      </div>
      <div className="mt-2 flex items-center gap-2 text-sm">
        <span className="glow-blue font-bold tabular-nums" style={{ color: '#93b4ff' }}>
          ▲ {formatEuros(eps)}/s
        </span>
        <span className="text-faint">passive income</span>
      </div>
    </div>
  );
}

'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { formatEuros } from '@/lib/game-engine';

interface Props {
  clickValue: number;
  epsDisplay: number;
  balance: number;
  onCLick: (x: number, y: number) => void;
}

export default function ClickButton({ clickValue, epsDisplay, balance, onCLick }: Props) {
  const [isPressed, setIsPressed] = useState(false);
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  let rippleId = 0;

  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    // Ripple effect
    const id = ++rippleId;
    setRipples((prev) => [...prev, { id, x: e.clientX - rect.left, y: e.clientY - rect.top }]);
    setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), 600);

    onCLick(x, y);
  }, [onCLick]);

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Balance display */}
      <div className="text-center">
        <motion.div
          key={Math.floor(balance)}
          initial={{ scale: 1.05 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.15 }}
          className="text-4xl font-bold text-yellow-400 tabular-nums"
        >
          {formatEuros(balance)}
        </motion.div>
        <div className="text-slate-400 text-sm mt-1">
          {formatEuros(epsDisplay)}/s
        </div>
      </div>

      {/* Main click button */}
      <motion.button
        whileTap={{ scale: 0.93 }}
        onPointerDown={() => setIsPressed(true)}
        onPointerUp={() => setIsPressed(false)}
        onPointerLeave={() => setIsPressed(false)}
        onClick={handleClick}
        className="relative w-36 h-36 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 shadow-2xl shadow-yellow-500/30 hover:shadow-yellow-500/50 transition-shadow cursor-pointer overflow-hidden select-none focus:outline-none"
        aria-label="Click to earn"
      >
        {/* Glow ring */}
        <motion.div
          animate={{ opacity: isPressed ? 1 : 0.4, scale: isPressed ? 1.1 : 1 }}
          transition={{ duration: 0.1 }}
          className="absolute inset-0 rounded-full border-2 border-yellow-200"
        />

        {/* Icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <Image
            src="/assets/click-icon.svg"
            alt="Click"
            width={72}
            height={72}
            className="drop-shadow-lg"
            draggable={false}
          />
        </div>

        {/* Ripples */}
        <AnimatePresence>
          {ripples.map((r) => (
            <motion.span
              key={r.id}
              initial={{ width: 0, height: 0, opacity: 0.6, x: r.x, y: r.y }}
              animate={{ width: 200, height: 200, opacity: 0, x: r.x - 100, y: r.y - 100 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="absolute rounded-full bg-white pointer-events-none"
            />
          ))}
        </AnimatePresence>
      </motion.button>

      <div className="text-slate-500 text-xs">
        +{formatEuros(clickValue)} per click
      </div>
    </div>
  );
}

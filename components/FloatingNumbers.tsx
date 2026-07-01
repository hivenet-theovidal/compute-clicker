'use client';

import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export interface FloatingNumber {
  id: number;
  value: string;
  x: number;
  y: number;
}

interface Props {
  numbers: FloatingNumber[];
}

export default function FloatingNumbers({ numbers }: Props) {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-50">
      <AnimatePresence>
        {numbers.map((n) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 1, y: 0, scale: 1 }}
            animate={{ opacity: 0, y: -80, scale: 1.2 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
            className="absolute text-yellow-400 font-bold text-lg select-none drop-shadow-lg"
            style={{ left: n.x, top: n.y }}
          >
            +{n.value}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

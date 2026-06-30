'use client';

import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  COMPONENTS,
  REGIONS,
  type ComponentType,
  type RegionId,
  type FullGameState,
  componentCost,
  canBuyComponent,
  formatEuros,
} from '@/lib/game-engine';

const COMPONENT_ORDER: ComponentType[] = ['cpu', 'ram', 'gpu', 'power', 'bandwidth', 'container'];

interface Props {
  state: FullGameState;
  activeRegion: RegionId;
  onBuy: (regionId: RegionId, componentType: ComponentType) => void;
}

export default function ShopPanel({ state, activeRegion, onBuy }: Props) {
  const region = state.regions[activeRegion];
  const regionDef = REGIONS[activeRegion];

  if (!region.unlocked) {
    const cost = regionDef.unlockCost;
    const canUnlock = state.totalEarned >= cost;
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-4 text-center">
        <div className="text-slate-500 text-sm">
          Region locked — requires {formatEuros(cost)} total earned
        </div>
        <div className="text-xs text-slate-600">
          You have earned {formatEuros(state.totalEarned)} total
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-2">
      {COMPONENT_ORDER.map((ctype) => {
        const def = COMPONENTS[ctype];
        const owned = region.components[ctype];
        const cost = componentCost(def, owned);
        const canAfford = state.balance >= cost;
        const requirementsMet = canBuyComponent(def, region.components);
        const buyable = canAfford && requirementsMet;

        return (
          <motion.button
            key={ctype}
            whileTap={buyable ? { scale: 0.97 } : {}}
            onClick={() => buyable && onBuy(activeRegion, ctype)}
            disabled={!buyable}
            className={`
              relative flex items-center gap-3 p-3 rounded-xl border transition-all text-left
              ${buyable
                ? 'border-slate-600 bg-slate-800/60 hover:bg-slate-700/60 hover:border-slate-500 cursor-pointer'
                : 'border-slate-700/50 bg-slate-800/20 cursor-not-allowed opacity-50'
              }
            `}
          >
            {/* Flash overlay on purchase */}
            <AnimatePresence>
              {buyable && (
                <motion.div
                  className="absolute inset-0 rounded-xl bg-yellow-400/10 pointer-events-none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0.3, 0] }}
                  transition={{ duration: 0.4, repeat: Infinity, repeatDelay: 2 }}
                />
              )}
            </AnimatePresence>

            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center">
              <Image
                src={`/assets/${ctype}.svg`}
                alt={def.name}
                width={28}
                height={28}
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-white text-sm font-semibold">{def.name}</span>
                <span className="text-slate-400 text-xs ml-2">×{owned}</span>
              </div>
              <div className="text-slate-400 text-xs truncate">{def.description}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-yellow-400 text-xs font-mono">{formatEuros(cost)}</span>
                <span className="text-green-400 text-xs">+{def.baseEps * regionDef.multiplier}/s</span>
              </div>
            </div>

            {!requirementsMet && def.requires && (
              <div className="text-xs text-slate-600 text-right flex-shrink-0">
                {Object.entries(def.requires).map(([r, q]) => (
                  <div key={r}>Need {q} {r.toUpperCase()}</div>
                ))}
              </div>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

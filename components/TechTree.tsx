'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  COMPONENTS,
  REGIONS,
  componentCost,
  canBuyComponent,
  regionEps,
  formatEuros,
  type ComponentType,
  type RegionId,
  type FullGameState,
} from '@/lib/game-engine';
import UpgradeNode, { COMPONENT_META } from './UpgradeNode';

const COMPONENT_ORDER: ComponentType[] = ['cpu', 'ram', 'gpu', 'power', 'bandwidth', 'container'];
const REGION_IMAGE: Record<RegionId, string> = { uae: 'uae', eu: 'france', us: 'usa', sea: 'asia', brazil: 'brazil' };

interface Props {
  state: FullGameState;
  activeRegion: RegionId;
  onBuy: (region: RegionId, type: ComponentType) => void;
}

export default function TechTree({ state, activeRegion, onBuy }: Props) {
  const [open, setOpen] = useState(true);
  const region = state.regions[activeRegion];
  const def = REGIONS[activeRegion];
  const eps = region.unlocked ? regionEps(activeRegion, region.components) : 0;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="glass glass-orange rounded-full px-5 py-3 text-sm font-black text-fg flex items-center gap-2"
      >
        <span className="text-base">🧬</span> TECH TREE
        <span className="text-accent-fg">▸</span>
      </button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 240, damping: 26 }}
      className="glass rounded-3xl w-[356px] p-3.5"
    >
      {/* header */}
      <div className="mb-2.5 flex items-center gap-2">
        <span className="text-base">🧬</span>
        <span className="text-xs font-black uppercase tracking-[0.22em] text-fg">Tech Tree</span>
      </div>

      {region.unlocked ? (
        <>
          {/* active region banner */}
          <div
            className="mb-3 flex items-center justify-between rounded-2xl px-3 py-2"
            style={{ background: `linear-gradient(120deg, ${def.color}22, transparent)`, boxShadow: `inset 0 0 0 1px ${def.color}33` }}
          >
            <div className="flex items-center gap-2">
              <img
                src={`/images/countries/${REGION_IMAGE[activeRegion]}.png`}
                alt={def.name}
                width={32}
                height={32}
                draggable={false}
                className="object-contain"
                style={{ filter: `drop-shadow(0 0 7px ${def.color}99)` }}
              />
              <div className="leading-tight">
                <div className="text-sm font-bold text-fg">{def.name}</div>
                <div className="text-[10px] text-dim">×{def.multiplier} yield multiplier</div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-sm font-bold tabular-nums" style={{ color: def.color }}>{formatEuros(eps)}/s</div>
              <div className="text-[10px] text-dim">region output</div>
            </div>
          </div>

          {/* node spine */}
          <div className="flex flex-col">
            {COMPONENT_ORDER.map((type, i) => {
              const cdef = COMPONENTS[type];
              const owned = region.components[type];
              const cost = componentCost(cdef, owned);
              const reqMet = canBuyComponent(cdef, region.components);
              const canAfford = state.balance >= cost;
              const prevColor = i > 0 ? COMPONENT_META[COMPONENT_ORDER[i - 1]].color : '';
              const prevMet = i > 0 ? region.components[COMPONENT_ORDER[i - 1]] > 0 : false;
              return (
                <div key={type}>
                  {i > 0 && (
                    <div className="ml-[32px] my-0.5 h-3.5 w-[3px] rounded-full overflow-hidden" style={{ color: prevMet ? `${prevColor}` : 'rgba(255,255,255,0.12)' }}>
                      <div className={prevMet ? 'flow h-full w-full' : 'h-full w-full'} style={{ opacity: prevMet ? 0.8 : 0.4 }} />
                    </div>
                  )}
                  <UpgradeNode
                    type={type}
                    owned={owned}
                    cost={cost}
                    canAfford={canAfford}
                    requirementsMet={reqMet}
                    regionComponents={region.components}
                    multiplier={def.multiplier}
                    balance={state.balance}
                    onBuy={() => onBuy(activeRegion, type)}
                  />
                </div>
              );
            })}
          </div>
        </>
      ) : (
        /* locked region preview — tease the unlock */
        <div className="flex flex-col items-center px-3 py-7 text-center">
          <div className="relative mb-3">
            <img
              src={`/images/countries/${REGION_IMAGE[activeRegion]}.png`}
              alt={def.name}
              width={78}
              height={78}
              draggable={false}
              className="object-contain"
              style={{ filter: `grayscale(0.65) brightness(0.85) drop-shadow(0 0 16px ${def.color}77)` }}
            />
            <span className="absolute -bottom-1 -right-1 text-2xl">🔒</span>
          </div>
          <div className="text-lg font-black text-fg">{def.name}</div>
          <div className="mb-4 text-[11px] text-dim">Datacenter offline · ×{def.multiplier} multiplier</div>

          <div className="w-full">
            <div className="relative h-2.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--gray-a3)' }}>
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-300"
                style={{
                  width: `${Math.min(100, (state.totalEarned / def.unlockCost) * 100)}%`,
                  background: `linear-gradient(90deg, ${def.color}, ${def.color}aa)`,
                  boxShadow: `0 0 12px -2px ${def.color}`,
                }}
              />
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] font-mono tabular-nums">
              <span className="text-muted">{formatEuros(state.totalEarned)}</span>
              <span style={{ color: def.color }}>{formatEuros(def.unlockCost)}</span>
            </div>
          </div>

          <div className="mt-3 text-[11px]">
            <span className="font-bold" style={{ color: def.color }}>
              {Math.floor(Math.min(100, (state.totalEarned / def.unlockCost) * 100))}% there
            </span>
            <span className="text-faint"> · {formatEuros(Math.max(0, def.unlockCost - state.totalEarned))} to go 🚀</span>
          </div>
        </div>
      )}

      {/* collapse */}
      <button onClick={() => setOpen(false)} className="mt-2.5 w-full text-center text-[10px] uppercase tracking-[0.2em] text-faint hover:text-dim transition-colors">
        ▾ minimise
      </button>

      <AnimatePresence />
    </motion.div>
  );
}

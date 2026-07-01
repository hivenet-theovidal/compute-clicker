'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  COMPONENTS,
  REGIONS,
  REGION_ORDER,
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
const FLAG: Record<RegionId, string> = { uae: '🇦🇪', eu: '🇪🇺', us: '🇺🇸', sea: '🇸🇬', brazil: '🇧🇷' };

interface Props {
  state: FullGameState;
  activeRegion: RegionId;
  onBuy: (region: RegionId, type: ComponentType) => void;
  onSelectRegion: (id: RegionId) => void;
}

export default function TechTree({ state, activeRegion, onBuy, onSelectRegion }: Props) {
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
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">🧬</span>
          <span className="text-xs font-black uppercase tracking-[0.22em] text-fg">Tech Tree</span>
        </div>
        {/* region switch pips */}
        <div className="flex items-center gap-1">
          {REGION_ORDER.map((rid) => {
            const rs = state.regions[rid];
            const active = rid === activeRegion;
            return (
              <button
                key={rid}
                onClick={() => rs.unlocked && onSelectRegion(rid)}
                title={REGIONS[rid].name}
                className="grid place-items-center rounded-full transition-transform"
                style={{
                  width: 24, height: 24, fontSize: 13,
                  filter: rs.unlocked ? 'none' : 'grayscale(1)',
                  opacity: rs.unlocked ? 1 : 0.45,
                  transform: active ? 'scale(1.18)' : 'scale(1)',
                  boxShadow: active ? `0 0 0 2px ${REGIONS[rid].color}, 0 0 12px ${REGIONS[rid].color}88` : 'none',
                }}
              >
                {rs.unlocked ? FLAG[rid] : '🔒'}
              </button>
            );
          })}
        </div>
      </div>

      {/* active region banner */}
      <div
        className="mb-3 flex items-center justify-between rounded-2xl px-3 py-2"
        style={{ background: `linear-gradient(120deg, ${def.color}22, transparent)`, boxShadow: `inset 0 0 0 1px ${def.color}33` }}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{FLAG[activeRegion]}</span>
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

      {/* collapse */}
      <button onClick={() => setOpen(false)} className="mt-2.5 w-full text-center text-[10px] uppercase tracking-[0.2em] text-faint hover:text-dim transition-colors">
        ▾ minimise
      </button>

      <AnimatePresence />
    </motion.div>
  );
}

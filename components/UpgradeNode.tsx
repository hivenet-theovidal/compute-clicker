'use client';

import { useEffect, useRef, useState } from 'react';
import { COMPONENTS, formatEuros, type ComponentType } from '@/lib/game-engine';

/** Each upgrade gets its own neon personality. */
export const COMPONENT_META: Record<ComponentType, { color: string; tag: string }> = {
  cpu:       { color: '#57b0ff', tag: 'Compute core' },
  ram:       { color: '#8b8bff', tag: 'Fast memory' },
  gpu:       { color: '#b06bff', tag: 'AI accelerator' },
  power:     { color: '#ffb454', tag: 'Power grid' },
  bandwidth: { color: '#43d6b5', tag: 'Network uplink' },
  container: { color: '#ff8a5c', tag: 'Policloud node' },
};

/** Provided artwork in public/images (bandwidth uses the wifi icon). */
export const COMPONENT_IMAGE: Record<ComponentType, string> = {
  cpu: 'cpu', ram: 'ram', gpu: 'gpu', power: 'power', bandwidth: 'wifi', container: 'container',
};

interface Props {
  type: ComponentType;
  owned: number;
  cost: number;
  canAfford: boolean;
  requirementsMet: boolean;
  regionComponents: Record<ComponentType, number>;
  multiplier: number;
  balance: number;
  onBuy: () => void;
}

export default function UpgradeNode({
  type, owned, cost, canAfford, requirementsMet, regionComponents, multiplier, balance, onBuy,
}: Props) {
  const def = COMPONENTS[type];
  const meta = COMPONENT_META[type];
  const buyable = canAfford && requirementsMet;
  const locked = !requirementsMet;
  const progress = requirementsMet ? Math.min(1, balance / cost) : 0;
  const perUnit = def.baseEps * multiplier;

  // Purchase juice: pop + sparks when owned goes up.
  const [popKey, setPopKey] = useState(0);
  const [sparks, setSparks] = useState<{ id: number; dx: number; dy: number }[]>([]);
  const prev = useRef(owned);
  const sid = useRef(0);
  useEffect(() => {
    if (owned > prev.current) {
      setPopKey((k) => k + 1);
      const burst = Array.from({ length: 9 }, () => {
        const a = Math.random() * Math.PI * 2;
        const d = 22 + Math.random() * 34;
        return { id: sid.current++, dx: Math.cos(a) * d, dy: Math.sin(a) * d };
      });
      setSparks((s) => [...s, ...burst]);
      const ids = burst.map((b) => b.id);
      setTimeout(() => setSparks((s) => s.filter((x) => !ids.includes(x.id))), 650);
    }
    prev.current = owned;
  }, [owned]);

  return (
    <button
      onClick={() => buyable && onBuy()}
      disabled={!buyable}
      className={`group relative w-full rounded-2xl text-left transition-transform ${buyable ? 'node-bob' : ''}`}
      style={{
        background: locked
          ? 'linear-gradient(160deg, rgba(30,40,66,0.5), rgba(16,22,40,0.4))'
          : 'linear-gradient(160deg, var(--gray-a3), var(--gray-a2))',
        boxShadow: buyable
          ? '0 0 0 1px #ff9a3366, 0 0 30px -8px #ff9a33, inset 0 1px 0 var(--gray-a5)'
          : locked
            ? `0 0 0 1px ${meta.color}22, inset 0 0 30px -22px ${meta.color}`
            : `0 0 0 1px ${meta.color}30, inset 0 1px 0 var(--gray-a4)`,
        cursor: buyable ? 'pointer' : 'default',
      }}
    >
      {/* clip layer — keeps sheen/scanline inside the rounded card while the icon bursts out */}
      <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
        {buyable && (
          <span className="sheen absolute top-0 left-0 h-full w-1/3" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,210,150,0.35), transparent)' }} />
        )}
        {locked && (
          <span className="absolute inset-x-0 top-0 h-6 opacity-40" style={{ background: `linear-gradient(${meta.color}00, ${meta.color}55, ${meta.color}00)` }}>
            <span className="scanline block h-full w-full" />
          </span>
        )}
      </span>

      <div className={`relative flex items-center gap-3 p-2.5 ${locked ? 'holo-flicker' : ''}`}>
        {/* Icon machine */}
        <div key={popKey} className={popKey ? 'node-pop' : ''}>
          <div className="relative" style={{ width: 46, height: 46 }}>
            {/* glowing pedestal */}
            <div
              className="absolute inset-0 rounded-xl"
              style={{
                background: locked ? 'rgba(10,16,30,0.6)' : `radial-gradient(circle at 35% 25%, ${meta.color}33, ${meta.color}0d 70%)`,
                boxShadow: locked
                  ? `inset 0 0 0 1px ${meta.color}40`
                  : `inset 0 0 0 1px ${meta.color}66, 0 0 18px -4px ${meta.color}`,
              }}
            />
            {buyable && <span className="ring-burst absolute inset-0 rounded-xl" style={{ boxShadow: `0 0 0 2px #ff9a33` }} />}
            {/* artwork bursts up out of the pedestal */}
            <img
              src={`/images/${COMPONENT_IMAGE[type]}.png`}
              alt={def.name}
              width={72}
              height={72}
              draggable={false}
              className="pointer-events-none absolute left-1/2 bottom-0 -translate-x-1/2 object-contain"
              style={locked
                ? { filter: 'grayscale(1) brightness(0.6)', opacity: 0.6 }
                : { filter: `drop-shadow(0 5px 7px rgba(0,0,0,0.6)) drop-shadow(0 0 11px ${meta.color}cc)` }}
            />
          </div>
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`truncate text-sm font-bold ${locked ? 'text-muted' : 'text-fg'}`}>{def.name}</span>
            {owned > 0 && (
              <span className="rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums" style={{ background: `${meta.color}22`, color: meta.color }}>
                Lv {owned >= 1000 ? `${(owned / 1000).toFixed(1)}k` : owned}
              </span>
            )}
          </div>

          {locked ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {def.requires &&
                (Object.entries(def.requires) as [ComponentType, number][]).map(([r, q]) => {
                  const met = regionComponents[r] >= q;
                  return (
                    <span
                      key={r}
                      className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                      style={{
                        background: met ? '#43d6b522' : 'rgba(255,255,255,0.05)',
                        color: met ? '#43d6b5' : '#8a8f9e',
                        boxShadow: met ? 'inset 0 0 0 1px #43d6b544' : 'inset 0 0 0 1px rgba(255,255,255,0.06)',
                      }}
                    >
                      {met ? '✓' : '◈'} {q} {COMPONENTS[r].name}
                    </span>
                  );
                })}
            </div>
          ) : (
            <div className="mt-0.5 flex items-center gap-2 text-[11px]">
              <span className="font-semibold" style={{ color: '#93b4ff' }}>+{formatEuros(perUnit)}/s each</span>
              <span className="text-faint">·</span>
              <span className="text-dim">{meta.tag}</span>
            </div>
          )}

          {/* progress / price */}
          {!locked && (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="relative h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }}>
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-200"
                  style={{
                    width: `${progress * 100}%`,
                    background: canAfford ? 'linear-gradient(90deg, #ffb257, #ff7a1a)' : `linear-gradient(90deg, ${meta.color}, ${meta.color}aa)`,
                    boxShadow: canAfford ? '0 0 10px #ff9a33' : 'none',
                  }}
                />
              </div>
              <span
                className="whitespace-nowrap font-mono text-xs font-bold tabular-nums"
                style={{ color: canAfford ? '#ffb257' : '#8a8f9e' }}
              >
                {formatEuros(cost)}
              </span>
            </div>
          )}
        </div>

        {/* spark particles */}
        <div className="pointer-events-none absolute left-6 top-6">
          {sparks.map((s) => (
            <span
              key={s.id}
              className="spark absolute h-1.5 w-1.5 rounded-full"
              style={{ ['--dx' as string]: `${s.dx}px`, ['--dy' as string]: `${s.dy}px`, background: '#ffcf8a', boxShadow: `0 0 8px ${meta.color}` }}
            />
          ))}
        </div>
      </div>
    </button>
  );
}

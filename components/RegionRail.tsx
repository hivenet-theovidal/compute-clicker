'use client';

import {
  REGIONS,
  REGION_ORDER,
  regionEps,
  formatEuros,
  type RegionId,
  type ComponentType,
  type FullGameState,
} from '@/lib/game-engine';
import { numFont } from '@/lib/fonts';

const REGION_IMAGE: Record<RegionId, string> = { uae: 'uae', eu: 'france', us: 'usa', sea: 'asia', brazil: 'brazil' };
const COMPONENT_ORDER: ComponentType[] = ['cpu', 'ram', 'gpu', 'power', 'bandwidth', 'container'];

interface Props {
  state: FullGameState;
  activeRegion: RegionId;
  onSelectRegion: (id: RegionId) => void;
}

/** Prominent region selector rail — which datacenter region you're building in. */
export default function RegionRail({ state, activeRegion, onSelectRegion }: Props) {
  return (
    <div className="glass rounded-2xl px-2 py-1.5 flex items-center gap-1.5">
      {REGION_ORDER.map((rid) => {
        const def = REGIONS[rid];
        const rs = state.regions[rid];
        const active = rid === activeRegion;
        const total = COMPONENT_ORDER.reduce((s, t) => s + rs.components[t], 0);
        const eps = rs.unlocked ? regionEps(rid, rs.components) : 0;

        return (
          <button
            key={rid}
            onClick={() => onSelectRegion(rid)}
            className="relative flex items-center gap-2 rounded-xl px-2.5 py-2 transition-all hover:brightness-125"
            style={{
              background: active ? `linear-gradient(160deg, ${def.color}30, ${def.color}10)` : 'transparent',
              boxShadow: active ? `inset 0 0 0 1.5px ${def.color}, 0 0 22px -4px ${def.color}` : 'none',
              opacity: 1,
              cursor: 'pointer',
              transform: active ? 'scale(1.05)' : 'scale(1)',
            }}
          >
            <img
              src={`/images/countries/${REGION_IMAGE[rid]}.png`}
              alt={def.name}
              width={78}
              height={78}
              draggable={false}
              className="shrink-0 object-contain"
              style={{
                marginTop: -42,
                marginBottom: -2,
                marginLeft: -4,
                marginRight: -6,
                filter: `drop-shadow(0 4px 7px #000b) drop-shadow(0 0 11px ${def.color}99)`,
              }}
            />
            <div className="text-left leading-tight">
              <div
                className="text-sm font-bold whitespace-nowrap"
                style={{ color: active ? def.color : rs.unlocked ? 'var(--gray-12)' : 'var(--gray-10)' }}
              >
                {def.name}
              </div>
              <div className={`${numFont.className} text-[11px] tabular-nums whitespace-nowrap`} style={{ color: active ? def.color : 'var(--gray-10)' }}>
                {rs.unlocked ? `${formatEuros(eps)}/s` : `🔒 ${formatEuros(def.unlockCost)}`}
              </div>
            </div>
            {rs.unlocked && total > 0 && (
              <span
                className={`${numFont.className} ml-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold`}
                style={{ background: 'linear-gradient(160deg, #ffd98a, #ffb43f)', color: '#3a2200' }}
              >
                {total >= 1000 ? `${(total / 1000).toFixed(1)}k` : total}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

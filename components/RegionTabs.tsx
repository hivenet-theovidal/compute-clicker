'use client';

import Image from 'next/image';
import * as Tabs from '@radix-ui/react-tabs';
import { REGIONS, REGION_ORDER, type RegionId, type FullGameState, regionEps, formatEuros } from '@/lib/game-engine';

interface Props {
  state: FullGameState;
  activeRegion: RegionId;
  onChangeRegion: (id: RegionId) => void;
}

export default function RegionTabs({ state, activeRegion, onChangeRegion }: Props) {
  return (
    <Tabs.Root value={activeRegion} onValueChange={(v) => onChangeRegion(v as RegionId)}>
      <Tabs.List className="flex gap-1 bg-slate-800/50 p-1 rounded-xl mb-4">
        {REGION_ORDER.map((rid) => {
          const def = REGIONS[rid];
          const rs = state.regions[rid];
          const eps = rs.unlocked ? regionEps(rid, rs.components) : 0;

          return (
            <Tabs.Trigger
              key={rid}
              value={rid}
              className={`
                flex-1 flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg text-xs transition-all
                data-[state=active]:bg-slate-700 data-[state=active]:text-white
                data-[state=inactive]:text-slate-500 data-[state=inactive]:hover:text-slate-300
                ${!rs.unlocked ? 'opacity-40' : ''}
              `}
            >
              <Image
                src={`/assets/region-${rid}.svg`}
                alt={def.name}
                width={20}
                height={20}
              />
              <span className="font-semibold">{def.name}</span>
              {rs.unlocked && (
                <span className="text-green-400 text-[10px] tabular-nums">
                  {formatEuros(eps)}/s
                </span>
              )}
              {!rs.unlocked && (
                <span className="text-slate-600 text-[10px]">locked</span>
              )}
            </Tabs.Trigger>
          );
        })}
      </Tabs.List>
    </Tabs.Root>
  );
}

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
      <Tabs.List className="flex gap-1 bg-surface-2/50 p-1 rounded-xl mb-4">
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
                data-[state=active]:bg-surface-3 data-[state=active]:text-fg
                data-[state=inactive]:text-dim data-[state=inactive]:hover:text-muted
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
                <span className="text-info-fg text-[10px] tabular-nums">
                  {formatEuros(eps)}/s
                </span>
              )}
              {!rs.unlocked && (
                <span className="text-faint text-[10px]">locked</span>
              )}
            </Tabs.Trigger>
          );
        })}
      </Tabs.List>
    </Tabs.Root>
  );
}

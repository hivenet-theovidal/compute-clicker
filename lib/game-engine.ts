// ───────────────────────────────────────────────────────────────
// HiveNet Clicker — Game Engine (pure TypeScript, no side effects)
// ───────────────────────────────────────────────────────────────

export type RegionId = 'uae' | 'eu' | 'us' | 'sea' | 'brazil';
export type ComponentType = 'cpu' | 'ram' | 'gpu' | 'power' | 'bandwidth' | 'container';

// -------------------------------------------------------------------
// Static definitions
// -------------------------------------------------------------------

export interface ComponentDef {
  id: ComponentType;
  name: string;
  baseCost: number;       // cost for first unit
  costGrowth: number;     // multiplicative factor per unit owned
  baseEps: number;        // €/s contributed per unit (before multipliers)
  /** Some components require others to be unlocked first */
  requires?: Partial<Record<ComponentType, number>>;
  description: string;
}

export const COMPONENTS: Record<ComponentType, ComponentDef> = {
  cpu: {
    id: 'cpu',
    name: 'CPU',
    baseCost: 10,
    costGrowth: 1.15,
    baseEps: 0.1,
    description: 'Entry-level compute unit. The backbone of any datacenter.',
  },
  ram: {
    id: 'ram',
    name: 'RAM',
    baseCost: 80,
    costGrowth: 1.15,
    baseEps: 0.5,
    requires: { cpu: 1 },
    description: 'Memory for your VMs. Requires at least one CPU.',
  },
  gpu: {
    id: 'gpu',
    name: 'GPU',
    baseCost: 500,
    costGrowth: 1.15,
    baseEps: 4,
    requires: { cpu: 5, ram: 2 },
    description: 'High-performance compute for AI workloads.',
  },
  power: {
    id: 'power',
    name: 'Power Supply',
    baseCost: 200,
    costGrowth: 1.12,
    baseEps: 1.5,
    requires: { cpu: 3 },
    description: 'Redundant power for uptime SLAs.',
  },
  bandwidth: {
    id: 'bandwidth',
    name: 'Bandwidth',
    baseCost: 300,
    costGrowth: 1.12,
    baseEps: 2,
    requires: { cpu: 2, ram: 1 },
    description: 'High-speed network uplinks.',
  },
  container: {
    id: 'container',
    name: 'Container Node',
    baseCost: 2000,
    costGrowth: 1.2,
    baseEps: 20,
    requires: { cpu: 10, ram: 5, gpu: 2, power: 3, bandwidth: 3 },
    description: 'A full Policloud container. Maximum revenue per unit.',
  },
};

export interface RegionDef {
  id: RegionId;
  name: string;
  /** Multiplier applied to all €/s in this region */
  multiplier: number;
  /** Unlock cost in total € earned */
  unlockCost: number;
  color: string;
}

export const REGIONS: Record<RegionId, RegionDef> = {
  uae: {
    id: 'uae',
    name: 'UAE',
    multiplier: 1.0,
    unlockCost: 0,
    color: '#F5A623',
  },
  eu: {
    id: 'eu',
    name: 'Europe',
    multiplier: 1.2,
    unlockCost: 500,
    color: '#4A90D9',
  },
  us: {
    id: 'us',
    name: 'United States',
    multiplier: 1.3,
    unlockCost: 2000,
    color: '#7B68EE',
  },
  sea: {
    id: 'sea',
    name: 'Southeast Asia',
    multiplier: 1.1,
    unlockCost: 1000,
    color: '#50C878',
  },
  brazil: {
    id: 'brazil',
    name: 'Brazil',
    multiplier: 1.15,
    unlockCost: 3000,
    color: '#FF6B6B',
  },
};

export const REGION_ORDER: RegionId[] = ['uae', 'eu', 'us', 'sea', 'brazil'];

// -------------------------------------------------------------------
// State types
// -------------------------------------------------------------------

export type RegionComponents = Record<ComponentType, number>;

export interface RegionState {
  components: RegionComponents;
  unlocked: boolean;
}

export type GameState = Record<RegionId, RegionState>;

export interface FullGameState {
  regions: GameState;
  totalEarned: number;
  balance: number;
  clickValue: number;
  lastTick: number; // timestamp ms
}

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

export function emptyRegionComponents(): RegionComponents {
  return { cpu: 0, ram: 0, gpu: 0, power: 0, bandwidth: 0, container: 0 };
}

export function initialGameState(): FullGameState {
  const regions = {} as GameState;
  for (const rid of REGION_ORDER) {
    regions[rid] = {
      components: emptyRegionComponents(),
      unlocked: rid === 'uae',
    };
  }
  return {
    regions,
    totalEarned: 0,
    balance: 0,
    clickValue: 1,
    lastTick: Date.now(),
  };
}

/** Cost of the NEXT unit of a component in a region */
export function componentCost(def: ComponentDef, owned: number): number {
  return Math.ceil(def.baseCost * Math.pow(def.costGrowth, owned));
}

/** Check if a component can be bought (requirements met) */
export function canBuyComponent(
  def: ComponentDef,
  regionComponents: RegionComponents
): boolean {
  if (!def.requires) return true;
  for (const [req, qty] of Object.entries(def.requires) as [ComponentType, number][]) {
    if (regionComponents[req] < qty) return false;
  }
  return true;
}

/** €/s for a single region */
export function regionEps(regionId: RegionId, components: RegionComponents): number {
  const region = REGIONS[regionId];
  let eps = 0;
  for (const [ctype, count] of Object.entries(components) as [ComponentType, number][]) {
    eps += COMPONENTS[ctype].baseEps * count;
  }
  return eps * region.multiplier;
}

/** Total €/s across all unlocked regions */
export function totalEps(state: FullGameState): number {
  let eps = 0;
  for (const rid of REGION_ORDER) {
    const rs = state.regions[rid];
    if (rs.unlocked) {
      eps += regionEps(rid, rs.components);
    }
  }
  return eps;
}

export const ATTACK_REDUCTION = 0.3;
export const ATTACK_DURATION_MS = 90_000;

/** Advance the game state by dt milliseconds (passive income) */
export function tick(state: FullGameState, nowMs: number, incomeMultiplier = 1.0): FullGameState {
  const dt = Math.max(0, (nowMs - state.lastTick) / 1000);
  const eps = totalEps(state);
  const earned = eps * dt * incomeMultiplier;
  return {
    ...state,
    balance: state.balance + earned,
    totalEarned: state.totalEarned + earned,
    lastTick: nowMs,
  };
}

/** Handle a manual click */
export function click(state: FullGameState): FullGameState {
  return {
    ...state,
    balance: state.balance + state.clickValue,
    totalEarned: state.totalEarned + state.clickValue,
  };
}

/** Attempt to purchase a component. Returns null if cannot afford / requirements not met. */
export function buyComponent(
  state: FullGameState,
  regionId: RegionId,
  componentType: ComponentType
): FullGameState | null {
  const region = state.regions[regionId];
  if (!region.unlocked) return null;

  const def = COMPONENTS[componentType];
  if (!canBuyComponent(def, region.components)) return null;

  const owned = region.components[componentType];
  const cost = componentCost(def, owned);
  if (state.balance < cost) return null;

  const newComponents = { ...region.components, [componentType]: owned + 1 };
  return {
    ...state,
    balance: state.balance - cost,
    regions: {
      ...state.regions,
      [regionId]: { ...region, components: newComponents },
    },
  };
}

/** Attempt to unlock a region */
export function unlockRegion(state: FullGameState, regionId: RegionId): FullGameState | null {
  const def = REGIONS[regionId];
  if (state.regions[regionId].unlocked) return null;
  if (state.totalEarned < def.unlockCost) return null;

  return {
    ...state,
    regions: {
      ...state.regions,
      [regionId]: { ...state.regions[regionId], unlocked: true },
    },
  };
}

/** Serialize / deserialize for API transport */
export function serializeState(state: FullGameState): string {
  return JSON.stringify(state);
}

export function deserializeState(json: string): FullGameState {
  const parsed = JSON.parse(json) as FullGameState;
  // Ensure all regions exist (migration safety)
  for (const rid of REGION_ORDER) {
    if (!parsed.regions[rid]) {
      parsed.regions[rid] = {
        components: emptyRegionComponents(),
        unlocked: rid === 'uae',
      };
    }
    // Ensure all components exist
    for (const ct of Object.keys(COMPONENTS) as ComponentType[]) {
      if (parsed.regions[rid].components[ct] === undefined) {
        parsed.regions[rid].components[ct] = 0;
      }
    }
  }
  return parsed;
}

/** Basic anti-cheat: validate that totalEarned didn't jump by more than possible */
export function validateStateDelta(
  previous: FullGameState | null,
  incoming: FullGameState,
  maxDeltaSeconds = 10,
  attackMultiplier = 1.0
): boolean {
  if (!previous) return true;
  const maxEps = totalEps(previous) * attackMultiplier;
  const timeDelta = maxDeltaSeconds;
  const maxPossibleEarned = previous.totalEarned + maxEps * timeDelta + previous.clickValue * 50;
  return incoming.totalEarned <= maxPossibleEarned + 1;
}

/** Human-friendly currency formatter */
export function formatEuros(value: number): string {
  if (value >= 1_000_000_000) return `€${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `€${(value / 1_000).toFixed(2)}K`;
  return `€${value.toFixed(2)}`;
}

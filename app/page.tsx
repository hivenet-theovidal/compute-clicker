'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import * as Toast from '@radix-ui/react-toast';

import NameModal from '@/components/NameModal';
import GameBackground from '@/components/GameBackground';
import PlanetView from '@/components/PlanetView';
import CurrencyHUD from '@/components/CurrencyHUD';
import DeployButton from '@/components/DeployButton';
import TechTree from '@/components/TechTree';
import LeaderboardWindow from '@/components/LeaderboardWindow';
import StatsWidget from '@/components/StatsWidget';
import FloatingNumbers, { type FloatingNumber } from '@/components/FloatingNumbers';

import {
  initialGameState,
  click,
  tick,
  buyComponent,
  unlockRegion,
  totalEps,
  formatEuros,
  REGIONS,
  REGION_ORDER,
  type FullGameState,
  type RegionId,
  type ComponentType,
} from '@/lib/game-engine';

const SAVE_INTERVAL_MS = 5000;
const TICK_INTERVAL_MS = 100;

let floatingIdCounter = 0;

export default function Home() {
  const [identified, setIdentified] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [gameState, setGameState] = useState<FullGameState>(initialGameState());
  const [activeRegion, setActiveRegion] = useState<RegionId>('uae');
  const [floatingNums, setFloatingNums] = useState<FloatingNumber[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [flashKey, setFlashKey] = useState(0);

  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const stateRef = useRef(gameState);
  stateRef.current = gameState;

  // ── Identify on mount ──────────────────────────────────────────
  useEffect(() => {
    fetch('/api/identify')
      .then((r) => r.json())
      .then(async (data: { identified: boolean; name?: string }) => {
        if (data.identified && data.name) {
          setPlayerName(data.name);
          setIdentified(true);
          const res = await fetch('/api/state');
          const json = (await res.json()) as { state: FullGameState };
          if (json.state) setGameState({ ...json.state, lastTick: Date.now() });
        }
        setLoaded(true);
      });
  }, []);

  // ── Game tick ──────────────────────────────────────────────────
  useEffect(() => {
    if (!identified) return;
    const interval = setInterval(() => setGameState((prev) => tick(prev, Date.now())), TICK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [identified]);

  // ── Auto-save ──────────────────────────────────────────────────
  useEffect(() => {
    if (!identified) return;
    const interval = setInterval(() => {
      fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: stateRef.current }),
      });
    }, SAVE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [identified]);

  // ── Region unlock check ────────────────────────────────────────
  const prevTotalRef = useRef(0);
  useEffect(() => {
    if (!identified) return;
    const prev = prevTotalRef.current;
    const cur = gameState.totalEarned;
    prevTotalRef.current = cur;
    if (cur <= prev) return;

    setGameState((s) => {
      let next = s;
      for (const rid of REGION_ORDER) {
        if (!next.regions[rid].unlocked) {
          const attempt = unlockRegion(next, rid);
          if (attempt) {
            next = attempt;
            setToastMsg(`🌍 New region online — ${REGIONS[rid].name}!`);
            setToastOpen(true);
          }
        }
      }
      return next;
    });
  }, [Math.floor(gameState.totalEarned / 50), identified]);

  // ── Handlers ──────────────────────────────────────────────────
  const spawnFloat = useCallback((x: number, y: number, value: string, crit = false) => {
    const id = ++floatingIdCounter;
    setFloatingNums((prev) => [...prev.slice(-18), { id, value, x: x - 12, y: y - 30, crit }]);
    setTimeout(() => setFloatingNums((prev) => prev.filter((n) => n.id !== id)), 1000);
  }, []);

  const handleClick = useCallback(
    (x: number, y: number) => {
      setGameState((prev) => click(prev));
      const crit = Math.random() < 0.12;
      spawnFloat(x + (Math.random() * 20 - 10), y, formatEuros(stateRef.current.clickValue), crit);
    },
    [spawnFloat],
  );

  const handleBuy = useCallback((regionId: RegionId, componentType: ComponentType) => {
    setGameState((prev) => {
      const next = buyComponent(prev, regionId, componentType);
      if (!next) return prev;
      setFlashKey((k) => k + 1);
      const newCount = next.regions[regionId].components[componentType];
      if (newCount === 1) {
        setToastMsg(`⚡ First ${componentType.toUpperCase()} online in ${REGIONS[regionId].name}!`);
        setToastOpen(true);
      }
      return next;
    });
  }, []);

  const handleIdentified = useCallback((name: string) => {
    setPlayerName(name);
    setIdentified(true);
    setGameState(initialGameState());
  }, []);

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#04060d' }}>
        <div className="text-dim text-sm animate-pulse tracking-widest uppercase">Booting HiveNet…</div>
      </div>
    );
  }

  const eps = totalEps(gameState);

  return (
    <Toast.Provider swipeDirection="right">
      <GameBackground />

      <main className="fixed inset-0 overflow-hidden text-fg">
        {/* Reward flash on purchase */}
        {flashKey > 0 && (
          <div
            key={flashKey}
            className="screen-flash pointer-events-none fixed inset-0 z-[60]"
            style={{ background: 'radial-gradient(80% 60% at 50% 60%, rgba(255,154,51,0.16), transparent 70%)' }}
          />
        )}

        {/* HERO GLOBE (centered) */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <PlanetView state={gameState} activeRegion={activeRegion} onSelectRegion={setActiveRegion} />
        </div>

        {/* Brand */}
        <div className="absolute left-5 top-4 flex items-center gap-2">
          <span className="grid place-items-center rounded-xl text-lg" style={{ width: 34, height: 34, background: 'linear-gradient(140deg,#ff9a33,#f36f14)', boxShadow: '0 0 18px -4px #ff9a33' }}>🛰️</span>
          <div className="leading-none">
            <div className="font-black tracking-tight text-fg glow-orange" style={{ color: '#ffb257' }}>HiveNet</div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-dim">Cloud Empire</div>
          </div>
        </div>

        {/* Player badge */}
        {identified && (
          <div className="glass absolute right-5 top-4 rounded-full px-4 py-2 text-xs">
            <span className="text-dim">Commander </span>
            <span className="font-bold text-fg">{playerName}</span>
          </div>
        )}

        {/* Currency HUD — top center */}
        <div className="absolute left-1/2 top-6 -translate-x-1/2">
          <CurrencyHUD balance={gameState.balance} eps={eps} />
        </div>

        {/* Leaderboard — left */}
        {identified && (
          <div className="absolute left-5 top-24">
            <LeaderboardWindow playerName={playerName} playerTotal={gameState.totalEarned} />
          </div>
        )}

        {/* Stats — bottom left */}
        <div className="absolute left-5 bottom-5">
          <StatsWidget totalEarned={gameState.totalEarned} eps={eps} clickValue={gameState.clickValue} />
        </div>

        {/* Deploy — bottom center */}
        <div className="absolute left-1/2 bottom-7 -translate-x-1/2">
          <DeployButton clickValue={gameState.clickValue} onCLick={handleClick} />
        </div>

        {/* Tech tree shop — bottom right */}
        <div className="absolute right-5 bottom-5">
          <TechTree state={gameState} activeRegion={activeRegion} onBuy={handleBuy} onSelectRegion={setActiveRegion} />
        </div>

        {/* Overlays */}
        <NameModal open={!identified && loaded} onIdentified={handleIdentified} />
        <FloatingNumbers numbers={floatingNums} />

        {/* Toast */}
        <Toast.Root
          open={toastOpen}
          onOpenChange={setToastOpen}
          duration={3200}
          className="glass glass-orange rounded-2xl px-4 py-3 flex items-center justify-center gap-3 transition-all data-[state=closed]:opacity-0 data-[state=closed]:translate-y-3"
        >
          <Toast.Description className="text-fg text-sm font-semibold">{toastMsg}</Toast.Description>
        </Toast.Root>
        <Toast.Viewport className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[80] flex flex-col gap-2 w-80 items-center" />
      </main>
    </Toast.Provider>
  );
}

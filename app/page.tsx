'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import * as Toast from '@radix-ui/react-toast';
import { motion } from 'framer-motion';

import NameModal from '@/components/NameModal';
import ClickButton from '@/components/ClickButton';
import RegionTabs from '@/components/RegionTabs';
import ShopPanel from '@/components/ShopPanel';
import Scoreboard from '@/components/Scoreboard';
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
          const json = await res.json() as { state: FullGameState };
          if (json.state) {
            setGameState({ ...json.state, lastTick: Date.now() });
          }
        }
        setLoaded(true);
      });
  }, []);

  // ── Game tick (passive income) ─────────────────────────────────
  useEffect(() => {
    if (!identified) return;
    const interval = setInterval(() => {
      setGameState((prev) => tick(prev, Date.now()));
    }, TICK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [identified]);

  // ── Auto-save every 5s ─────────────────────────────────────────
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
            setToastMsg(`🌍 Region unlocked: ${REGIONS[rid].name}!`);
            setToastOpen(true);
          }
        }
      }
      return next;
    });
  }, [Math.floor(gameState.totalEarned / 50), identified]);

  // ── Handlers ──────────────────────────────────────────────────
  const handleClick = useCallback((x: number, y: number) => {
    setGameState((prev) => click(prev));
    const value = formatEuros(stateRef.current.clickValue);
    const id = ++floatingIdCounter;
    setFloatingNums((prev) => [...prev.slice(-15), { id, value, x: x - 20, y: y - 40 }]);
    setTimeout(() => {
      setFloatingNums((prev) => prev.filter((n) => n.id !== id));
    }, 1000);
  }, []);

  const handleBuy = useCallback((regionId: RegionId, componentType: ComponentType) => {
    setGameState((prev) => {
      const next = buyComponent(prev, regionId, componentType);
      if (!next) return prev;
      const newCount = next.regions[regionId].components[componentType];
      if (newCount === 1) {
        setToastMsg(`⚡ First ${componentType.toUpperCase()} in ${REGIONS[regionId].name}!`);
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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-500 text-sm animate-pulse">Loading…</div>
      </div>
    );
  }

  const eps = totalEps(gameState);

  return (
    <Toast.Provider swipeDirection="right">
      {/* Background pattern */}
      <div
        className="fixed inset-0 opacity-30 pointer-events-none"
        style={{ backgroundImage: 'url(/assets/bg-pattern.svg)', backgroundSize: '60px 60px' }}
      />

      <div className="relative min-h-screen bg-slate-950/90 text-white flex flex-col">
        {/* Header */}
        <header className="border-b border-slate-800 px-6 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-yellow-400 font-bold text-lg tracking-tight">HiveNet</span>
            <span className="text-slate-600 text-sm">Cloud Clicker</span>
          </div>
          {identified && (
            <div className="text-slate-400 text-sm">
              Playing as <span className="text-white font-semibold">{playerName}</span>
            </div>
          )}
        </header>

        {/* Main layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Click area */}
          <div className="flex-1 flex items-center justify-center p-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <ClickButton
                clickValue={gameState.clickValue}
                epsDisplay={eps}
                balance={gameState.balance}
                onCLick={handleClick}
              />
            </motion.div>
          </div>

          {/* Center: Shop */}
          <div className="w-[420px] border-l border-r border-slate-800 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex-shrink-0">
              <h2 className="text-slate-300 text-sm font-semibold uppercase tracking-widest text-center">
                Datacenter Shop
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <RegionTabs
                state={gameState}
                activeRegion={activeRegion}
                onChangeRegion={setActiveRegion}
              />
              <ShopPanel
                state={gameState}
                activeRegion={activeRegion}
                onBuy={handleBuy}
              />
            </div>
          </div>

          {/* Right: Scoreboard + Stats */}
          <div className="w-72 p-4 flex flex-col gap-4 overflow-y-auto">
            {identified && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Scoreboard
                  playerName={playerName}
                  playerTotal={gameState.totalEarned}
                />
              </motion.div>
            )}

            {/* Stats panel */}
            <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-4 text-xs space-y-2">
              <h3 className="text-slate-400 uppercase tracking-widest text-center mb-3">Stats</h3>
              <div className="flex justify-between">
                <span className="text-slate-500">Total earned</span>
                <span className="text-white font-mono">{formatEuros(gameState.totalEarned)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Balance</span>
                <span className="text-yellow-400 font-mono">{formatEuros(gameState.balance)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Income/s</span>
                <span className="text-green-400 font-mono">{formatEuros(eps)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Click value</span>
                <span className="text-slate-300 font-mono">{formatEuros(gameState.clickValue)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Overlays */}
        <NameModal open={!identified && loaded} onIdentified={handleIdentified} />
        <FloatingNumbers numbers={floatingNums} />

        {/* Toast */}
        <Toast.Root
          open={toastOpen}
          onOpenChange={setToastOpen}
          duration={3000}
          className="bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 shadow-2xl flex items-center gap-3"
        >
          <Toast.Description className="text-white text-sm font-medium">
            {toastMsg}
          </Toast.Description>
          <Toast.Close className="text-slate-500 hover:text-white text-xs ml-2">✕</Toast.Close>
        </Toast.Root>
        <Toast.Viewport className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-72" />
      </div>
    </Toast.Provider>
  );
}

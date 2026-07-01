'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import * as Toast from '@radix-ui/react-toast';
import { motion, AnimatePresence } from 'framer-motion';

import NameModal from '@/components/NameModal';
import PlanetView from '@/components/PlanetView';
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

// Natural size of PlanetView (px) — must match actual render dimensions
const PLANET_VIEW_W = 680;
const PLANET_VIEW_H = 980;

function PlanetPanel({
  gameState, activeRegion, onCLick, onSelectRegion, underAttack,
}: {
  gameState: FullGameState;
  activeRegion: RegionId;
  onCLick: (x: number, y: number) => void;
  onSelectRegion: (id: RegionId) => void;
  underAttack: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setScale(Math.min(1, width / PLANET_VIEW_W, height / PLANET_VIEW_H));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="flex-1 relative overflow-hidden">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: PLANET_VIEW_W,
          height: PLANET_VIEW_H,
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: 'center center',
        }}
      >
        <PlanetView
          state={gameState}
          activeRegion={activeRegion}
          onCLick={onCLick}
          onSelectRegion={onSelectRegion}
        />
        {underAttack && (
          <motion.div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.15) 0%, rgba(239,68,68,0.05) 60%, transparent 80%)' }}
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </motion.div>
    </div>
  );
}

interface ActiveAttack {
  attacker_id: string;
  reduction: number;
  expires_at: number;
}

interface AttacksResponse {
  activeAttacks: ActiveAttack[];
  myCooldowns: Record<string, number>;
}

export default function Home() {
  const [identified, setIdentified] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [gameState, setGameState] = useState<FullGameState>(initialGameState());
  const [activeRegion, setActiveRegion] = useState<RegionId>('uae');
  const [floatingNums, setFloatingNums] = useState<FloatingNumber[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastVariant, setToastVariant] = useState<'default' | 'red' | 'green'>('default');

  // Attack state
  const [underAttack, setUnderAttack] = useState<{ reduction: number; expiresAt: number } | null>(null);
  const knownAttackExpiresRef = useRef<number | null>(null);

  const stateRef = useRef(gameState);
  stateRef.current = gameState;

  // ── Identify on mount ──────────────────────────────────────────
  useEffect(() => {
    fetch('/api/identify')
      .then((r) => r.json())
      .then(async (data: { identified: boolean; name?: string; id?: string }) => {
        if (data.identified && data.name) {
          setPlayerName(data.name);
          if (data.id) setPlayerId(data.id);
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

  // ── Poll attacks every 5s ─────────────────────────────────────
  useEffect(() => {
    if (!identified) return;
    const poll = async () => {
      const res = await fetch('/api/attacks');
      if (!res.ok) return;
      const data = await res.json() as AttacksResponse;
      const attacks = data.activeAttacks ?? [];

      if (attacks.length > 0) {
        const attack = attacks[0];
        const isNew = knownAttackExpiresRef.current !== attack.expires_at;
        knownAttackExpiresRef.current = attack.expires_at;
        setUnderAttack({ reduction: attack.reduction, expiresAt: attack.expires_at });
        if (isNew) {
          setToastMsg('🔴 Sabotage detected — income -30% for 90s');
          setToastVariant('red');
          setToastOpen(true);
        }
      } else {
        if (knownAttackExpiresRef.current !== null) {
          knownAttackExpiresRef.current = null;
          setUnderAttack(null);
          setToastMsg('✅ Sabotage neutralized');
          setToastVariant('green');
          setToastOpen(true);
        }
      }
    };
    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [identified]);

  // ── Game tick (passive income) ─────────────────────────────────
  const underAttackRef = useRef(underAttack);
  underAttackRef.current = underAttack;

  useEffect(() => {
    if (!identified) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const attack = underAttackRef.current;
      const multiplier = attack && attack.expiresAt > now ? 1 - attack.reduction : 1.0;
      setGameState((prev) => tick(prev, now, multiplier));
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
            setToastVariant('default');
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
        setToastVariant('default');
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

  const baseEps = totalEps(gameState);
  const attackMultiplier = underAttack && underAttack.expiresAt > Date.now() ? 1 - underAttack.reduction : 1.0;
  const eps = baseEps * attackMultiplier;

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
          {/* Left: Planet + click button — responsive scale */}
          <PlanetPanel
            gameState={gameState}
            activeRegion={activeRegion}
            onCLick={handleClick}
            onSelectRegion={setActiveRegion}
            underAttack={!!(underAttack && underAttack.expiresAt > Date.now())}
          />

          {/* Center: Shop */}
          <div className="w-[360px] border-l border-r border-slate-800 flex flex-col overflow-hidden">
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
          <div className="w-60 p-4 flex flex-col gap-4 overflow-y-auto">
            {identified && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Scoreboard
                  playerName={playerName}
                  playerTotal={gameState.totalEarned}
                  playerBalance={gameState.balance}
                  playerId={playerId}
                  onAttackLaunched={() => {
                    // Refresh balance from state (state will auto-update on next save)
                  }}
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
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Income/s</span>
                <div className="flex items-center gap-1.5">
                  {attackMultiplier < 1 && (
                    <span className="text-red-400 font-mono line-through opacity-60">{formatEuros(baseEps)}</span>
                  )}
                  <span className={`font-mono ${attackMultiplier < 1 ? 'text-red-400' : 'text-green-400'}`}>{formatEuros(eps)}</span>
                </div>
              </div>
              {attackMultiplier < 1 && (
                <div className="flex justify-between items-center">
                  <span className="text-red-500/80">Sabotage</span>
                  <span className="text-red-400 font-mono">-{Math.round((1 - attackMultiplier) * 100)}%</span>
                </div>
              )}
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
          duration={4000}
          className={`border rounded-xl px-4 py-3 shadow-2xl flex items-center gap-3 ${
            toastVariant === 'red'
              ? 'bg-red-950 border-red-500/60'
              : toastVariant === 'green'
              ? 'bg-green-950 border-green-500/60'
              : 'bg-slate-800 border-slate-600'
          }`}
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

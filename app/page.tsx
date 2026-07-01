'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import * as Toast from '@radix-ui/react-toast';
import { motion } from 'framer-motion';

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

// Natural size of PlanetView (px) — must match actual render dimensions
const PLANET_VIEW_W = 680;
const PLANET_VIEW_H = 980;

function PlanetPanel({
  gameState, activeRegion, onCLick, onSelectRegion,
}: {
  gameState: FullGameState;
  activeRegion: RegionId;
  onCLick: (x: number, y: number) => void;
  onSelectRegion: (id: RegionId) => void;
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
      </motion.div>
    </div>
  );
}

export default function Home() {
  const [identified, setIdentified] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [gameState, setGameState] = useState<FullGameState>(initialGameState());
  const [activeRegion, setActiveRegion] = useState<RegionId>('uae');
  const [floatingNums, setFloatingNums] = useState<FloatingNumber[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [flashKey, setFlashKey] = useState(0);

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
          const json = (await res.json()) as { state: FullGameState };
          if (json.state) setGameState({ ...json.state, lastTick: Date.now() });
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
  useEffect(() => {
    if (!identified) return;
    const interval = setInterval(() => {
      setGameState((prev) => tick(prev, Date.now()));
    }, TICK_INTERVAL_MS);
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
            setToastMsg(`🌍 Region unlocked: ${REGIONS[rid].name}!`);
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#04060d' }}>
        <div className="text-dim text-sm animate-pulse tracking-widest uppercase">Booting HiveNet…</div>
      </div>
    );
  }

  const baseEps = totalEps(gameState);
  const attackMultiplier = underAttack && underAttack.expiresAt > Date.now() ? 1 - underAttack.reduction : 1.0;
  const eps = baseEps * attackMultiplier;

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
          <Toast.Description className="text-fg text-sm font-semibold">{toastMsg}</Toast.Description>
        </Toast.Root>
        <Toast.Viewport className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[80] flex flex-col gap-2 w-80 items-center" />
      </main>
    </Toast.Provider>
  );
}

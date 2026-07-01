'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import * as Toast from '@radix-ui/react-toast';

import NameModal from '@/components/NameModal';
import GameBackground from '@/components/GameBackground';
import PlanetView from '@/components/PlanetView';
import CurrencyHUD from '@/components/CurrencyHUD';
import DeployButton from '@/components/DeployButton';
import RegionRail from '@/components/RegionRail';
import TechTree from '@/components/TechTree';
import LeaderboardWindow from '@/components/LeaderboardWindow';
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

interface AttacksResponse {
  activeAttacks: { reduction: number; expires_at: number }[];
  myCooldowns: Record<string, number>;
}

const TOAST_STYLE: Record<'default' | 'red' | 'green', { border: string; glow: string }> = {
  default: { border: '#ff9a3355', glow: '#ff9a33' },
  red: { border: '#ff5a5a66', glow: '#ff3b3b' },
  green: { border: '#43d6b566', glow: '#22c39a' },
};

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

  const [underAttack, setUnderAttack] = useState<{ reduction: number; expiresAt: number } | null>(null);
  const knownAttackExpiresRef = useRef<number | null>(null);

  const stateRef = useRef(gameState);
  stateRef.current = gameState;

  const showToast = useCallback((msg: string, variant: 'default' | 'red' | 'green' = 'default') => {
    setToastMsg(msg);
    setToastVariant(variant);
    setToastOpen(true);
  }, []);

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

  // ── Poll sabotage attacks ──────────────────────────────────────
  useEffect(() => {
    if (!identified) return;
    const poll = async () => {
      const res = await fetch('/api/attacks');
      if (!res.ok) return;
      const data = (await res.json()) as AttacksResponse;
      const attacks = data.activeAttacks ?? [];
      if (attacks.length > 0) {
        const attack = attacks[0];
        const isNew = knownAttackExpiresRef.current !== attack.expires_at;
        knownAttackExpiresRef.current = attack.expires_at;
        setUnderAttack({ reduction: attack.reduction, expiresAt: attack.expires_at });
        if (isNew) showToast('🔴 Sabotage detected — income −30% for 90s', 'red');
      } else if (knownAttackExpiresRef.current !== null) {
        knownAttackExpiresRef.current = null;
        setUnderAttack(null);
        showToast('✅ Sabotage neutralized', 'green');
      }
    };
    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [identified, showToast]);

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
            showToast(`🌍 New region online — ${REGIONS[rid].name}!`);
          }
        }
      }
      return next;
    });
  }, [Math.floor(gameState.totalEarned / 50), identified, showToast]);

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

  const handleBuy = useCallback(
    (regionId: RegionId, componentType: ComponentType) => {
      setGameState((prev) => {
        const next = buyComponent(prev, regionId, componentType);
        if (!next) return prev;
        setFlashKey((k) => k + 1);
        const newCount = next.regions[regionId].components[componentType];
        if (newCount === 1) showToast(`⚡ First ${componentType.toUpperCase()} online in ${REGIONS[regionId].name}!`);
        return next;
      });
    },
    [showToast],
  );

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
  const attacked = !!underAttack && underAttack.expiresAt > Date.now();
  const eps = baseEps * (attacked ? 1 - underAttack!.reduction : 1);
  const attackSecs = attacked ? Math.max(0, Math.ceil((underAttack!.expiresAt - Date.now()) / 1000)) : 0;
  const tv = TOAST_STYLE[toastVariant];
  const toastSpace = toastMsg.indexOf(' ');
  const toastIcon = toastSpace > 0 ? toastMsg.slice(0, toastSpace) : '✨';
  const toastText = toastSpace > 0 ? toastMsg.slice(toastSpace + 1) : toastMsg;

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

        {/* HERO GLOBE */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <PlanetView state={gameState} activeRegion={activeRegion} onSelectRegion={setActiveRegion} />
        </div>

        {/* Player badge — commented out for now
        {identified && (
          <div className="glass absolute right-5 top-4 rounded-full px-4 py-2 text-xs">
            <span className="text-dim">Commander </span>
            <span className="font-bold text-fg">{playerName}</span>
          </div>
        )}
        */}

        {/* Balance — top left */}
        <div className="absolute left-8 top-6 flex flex-col items-start">
          <CurrencyHUD balance={gameState.balance} eps={eps} />
          {attacked && (
            <div
              className="glow-pulse mt-2 rounded-full px-3 py-1 text-[11px] font-bold"
              style={{ background: 'rgba(255,59,59,0.14)', color: '#ff8a8a', boxShadow: 'inset 0 0 0 1px #ff5a5a55' }}
            >
              ⚠ UNDER SABOTAGE · −{Math.round(underAttack!.reduction * 100)}% · {attackSecs}s
            </div>
          )}
        </div>

        {/* Region selector — top center */}
        <div className="absolute left-1/2 top-10 -translate-x-1/2">
          <RegionRail state={gameState} activeRegion={activeRegion} onSelectRegion={setActiveRegion} />
        </div>

        {/* Player HUD — leaderboard + stats merged, bottom left */}
        {identified && (
          <div className="absolute left-5 bottom-5">
            <LeaderboardWindow
              playerName={playerName}
              playerId={playerId}
              playerTotal={gameState.totalEarned}
              playerBalance={gameState.balance}
              eps={eps}
              clickValue={gameState.clickValue}
            />
          </div>
        )}

        {/* Deploy — bottom center */}
        <div className="absolute left-1/2 bottom-10 -translate-x-1/2">
          <DeployButton clickValue={gameState.clickValue} onCLick={handleClick} />
        </div>

        {/* Tech tree */}
        <div className="absolute right-5 bottom-5">
          <TechTree state={gameState} activeRegion={activeRegion} onBuy={handleBuy} />
        </div>

        {/* Overlays */}
        <NameModal open={!identified && loaded} onIdentified={handleIdentified} />
        <FloatingNumbers numbers={floatingNums} />

        {/* Toast — prominent announcement */}
        <Toast.Root
          open={toastOpen}
          onOpenChange={setToastOpen}
          duration={3600}
          className="toast-root glass rounded-2xl pl-3 pr-5 py-3 flex items-center gap-3"
          style={{ boxShadow: `0 0 0 1.5px ${tv.border}, 0 0 55px -6px ${tv.glow}, inset 0 0 40px -20px ${tv.glow}, 0 24px 70px -30px rgba(0,0,0,0.9)` }}
        >
          <span
            className="glow-pulse grid place-items-center rounded-xl text-2xl shrink-0"
            style={{ width: 44, height: 44, background: `${tv.glow}22`, boxShadow: `inset 0 0 0 1px ${tv.glow}66` }}
          >
            {toastIcon}
          </span>
          <Toast.Description className="text-fg text-base font-bold tracking-tight whitespace-nowrap">{toastText}</Toast.Description>
        </Toast.Root>
        <Toast.Viewport className="fixed top-1/3 left-1/2 -translate-x-1/2 z-[90] flex flex-col gap-2 items-center" />
      </main>
    </Toast.Provider>
  );
}

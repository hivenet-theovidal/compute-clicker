'use client';

import { useEffect, useRef, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import createGlobe from 'cobe';
import type { Arc } from 'cobe';
import {
  COMPONENTS,
  REGIONS,
  REGION_ORDER,
  type ComponentType,
  type RegionId,
  type FullGameState,
  formatEuros,
  totalEps,
} from '@/lib/game-engine';

// ── Globe geometry ─────────────────────────────────────────────
const GLOBE_SIZE = 560;
const CENTER = GLOBE_SIZE / 2;
const RADIUS_PX = GLOBE_SIZE * 0.46; // on-screen sphere radius (tune if flags float off the surface)

const COMPONENT_ORDER: ComponentType[] = ['cpu', 'ram', 'gpu', 'power', 'bandwidth', 'container'];

// Real-world lat/lng for each region (representative data-center cities)
const REGION_LOCATION: Record<RegionId, [number, number]> = {
  uae:    [25.20,  55.27],   // Dubai
  eu:     [50.11,   8.68],   // Frankfurt
  us:     [38.90, -77.04],   // N. Virginia
  sea:    [ 1.35, 103.82],   // Singapore
  brazil: [-23.55, -46.63],  // São Paulo
};

// Flag emoji per region 🎉
const REGION_FLAG: Record<RegionId, string> = {
  uae:    '🇦🇪',
  eu:     '🇪🇺',
  us:     '🇺🇸',
  sea:    '🇸🇬',
  brazil: '🇧🇷',
};

// ── Colour helpers ─────────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
const REGION_RGB: Record<RegionId, [number, number, number]> = {
  uae:    hexToRgb(REGIONS.uae.color),
  eu:     hexToRgb(REGIONS.eu.color),
  us:     hexToRgb(REGIONS.us.color),
  sea:    hexToRgb(REGIONS.sea.color),
  brazil: hexToRgb(REGIONS.brazil.color),
};

const D = Math.PI / 180;

// Convert a location to the [phi, theta] that centres it toward the camera.
function locationToAngles(lat: number, lng: number): [number, number] {
  return [Math.PI - lng * D - Math.PI / 2, lat * D];
}

// Project a region onto the globe's screen space for the current rotation.
// Returns pixel position + depth z (z > 0 ⇒ facing the camera). See scratch
// validation: facing UAE puts EU up-left, SEA right, US/Brazil on the back.
function projectRegion(rid: RegionId, phi: number, theta: number) {
  const [lat, lng] = REGION_LOCATION[rid];
  const f = lat * D;
  const p0 = Math.PI - lng * D - Math.PI / 2;
  const a = phi - p0;
  const cosF = Math.cos(f), sinF = Math.sin(f);
  const cosT = Math.cos(theta), sinT = Math.sin(theta);
  const cosA = Math.cos(a), sinA = Math.sin(a);
  const X = cosF * sinA;
  const Y = sinF * cosT - cosF * cosA * sinT;
  const Z = sinF * sinT + cosF * cosA * cosT;
  return { x: CENTER + RADIUS_PX * X, y: CENTER - RADIUS_PX * Y, z: Z };
}

// Pick the equivalent of `target` phi nearest to `current` (avoids long spins).
function nearestAngle(current: number, target: number): number {
  let d = (target - current) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return current + d;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function regionTotal(state: FullGameState, rid: RegionId): number {
  const c = state.regions[rid].components;
  return COMPONENT_ORDER.reduce((sum, t) => sum + c[t], 0);
}

// Glowing network links from the active region to every other unlocked region.
function buildArcs(state: FullGameState, active: RegionId): Arc[] {
  if (!state.regions[active].unlocked) return [];
  return REGION_ORDER.filter((rid) => rid !== active && state.regions[rid].unlocked).map((rid) => ({
    from: REGION_LOCATION[active],
    to: REGION_LOCATION[rid],
    color: REGION_RGB[active],
  }));
}

// ── Component ──────────────────────────────────────────────────
interface Props {
  state: FullGameState;
  activeRegion: RegionId;
  onCLick: (x: number, y: number) => void;
  onSelectRegion: (id: RegionId) => void;
}

export default function PlanetView({ state, activeRegion, onCLick, onSelectRegion }: Props) {
  const eps = totalEps(state);

  const handleClickBtn = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => onCLick(e.clientX, e.clientY),
    [onCLick],
  );

  // ── Rotation state (refs so the RAF loop survives re-renders) ──
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phiRef = useRef(0);
  const thetaRef = useRef(0.2);
  const targetPhiRef = useRef(0);
  const targetThetaRef = useRef(0.2);
  const draggingRef = useRef(false);
  const dragPrevRef = useRef<{ x: number; y: number } | null>(null);

  // DOM refs to the flag markers, updated imperatively each frame.
  const flagRefs = useRef<Partial<Record<RegionId, HTMLButtonElement>>>({});

  // Network arcs pushed into the globe only when they actually change.
  const arcsRef = useRef<Arc[]>(buildArcs(state, activeRegion));
  const dirtyRef = useRef(false);

  // Signature of everything that affects arcs (not per-tick balance).
  const arcSig = useMemo(
    () => REGION_ORDER.map((rid) => (state.regions[rid].unlocked ? 1 : 0)).join('') + activeRegion,
    [state, activeRegion],
  );

  useEffect(() => {
    arcsRef.current = buildArcs(state, activeRegion);
    dirtyRef.current = true;
  }, [arcSig]); // eslint-disable-line react-hooks/exhaustive-deps

  // Spin the globe to face the active region whenever it changes.
  useEffect(() => {
    const [p, t] = locationToAngles(...REGION_LOCATION[activeRegion]);
    targetPhiRef.current = nearestAngle(targetPhiRef.current, p);
    targetThetaRef.current = clamp(t, -0.5, 0.5);
  }, [activeRegion]);

  // ── Create globe + drive the render loop ──────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2);
    let firstFrame = true;
    let raf = 0;

    const globe = createGlobe(canvas, {
      devicePixelRatio: dpr,
      width: GLOBE_SIZE * dpr,
      height: GLOBE_SIZE * dpr,
      phi: phiRef.current,
      theta: thetaRef.current,
      dark: 1,
      diffuse: 1.25,
      mapSamples: 16000,
      mapBrightness: 5,
      baseColor: [0.17, 0.19, 0.24],
      markerColor: [1.0, 0.6, 0.2],
      glowColor: [0.16, 0.28, 0.55],
      markers: [], // regions are rendered as HTML flag emojis on top
      arcs: arcsRef.current,
      arcColor: [1.0, 0.6, 0.2],
      arcWidth: 0.4,
      arcHeight: 0.35,
      markerElevation: 0.02,
    });

    const loop = () => {
      if (!draggingRef.current) targetPhiRef.current += 0.0025; // gentle auto-rotation
      phiRef.current += (targetPhiRef.current - phiRef.current) * 0.12;
      thetaRef.current += (targetThetaRef.current - thetaRef.current) * 0.12;

      const update: Parameters<typeof globe.update>[0] = {
        phi: phiRef.current,
        theta: thetaRef.current,
      };
      if (dirtyRef.current) {
        update.arcs = arcsRef.current;
        dirtyRef.current = false;
      }
      globe.update(update);

      // Position the flag emojis over their sphere coordinates.
      for (const rid of REGION_ORDER) {
        const el = flagRefs.current[rid];
        if (!el) continue;
        const { x, y, z } = projectRegion(rid, phiRef.current, thetaRef.current);
        const depth = Math.max(0, z);
        const scale = 0.72 + 0.28 * depth;
        el.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${scale})`;
        el.style.opacity = String(clamp(z / 0.16, 0, 1));
        el.style.zIndex = String(Math.round((z + 1) * 100));
        el.style.pointerEvents = z > 0.05 ? 'auto' : 'none';
      }

      if (firstFrame) {
        firstFrame = false;
        canvas.style.opacity = '1';
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      globe.destroy();
    };
  }, []);

  // ── Drag-to-rotate ────────────────────────────────────────────
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    draggingRef.current = true;
    dragPrevRef.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.style.cursor = 'grabbing';
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draggingRef.current || !dragPrevRef.current) return;
    const dx = e.clientX - dragPrevRef.current.x;
    const dy = e.clientY - dragPrevRef.current.y;
    dragPrevRef.current = { x: e.clientX, y: e.clientY };
    targetPhiRef.current += dx * 0.005;
    targetThetaRef.current = clamp(targetThetaRef.current - dy * 0.005, -0.5, 0.5);
  }, []);

  const endDrag = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    draggingRef.current = false;
    dragPrevRef.current = null;
    e.currentTarget.style.cursor = 'grab';
  }, []);

  const setFlagRef = useCallback(
    (rid: RegionId) => (el: HTMLButtonElement | null) => {
      if (el) flagRefs.current[rid] = el;
    },
    [],
  );

  return (
    <div className="flex flex-col items-center gap-4 select-none w-full pt-6 pb-4">
      {/* Balance + eps */}
      <div className="text-center">
        <motion.div
          key={Math.floor(state.balance / 0.5)}
          initial={{ scale: 1.04 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.12 }}
          className="text-5xl font-bold text-accent-fg tabular-nums"
        >
          {formatEuros(state.balance)}
        </motion.div>
        <div className="text-muted text-base mt-1">{formatEuros(eps)}/s</div>
      </div>

      {/* Globe */}
      <div className="relative shrink-0" style={{ width: GLOBE_SIZE, height: GLOBE_SIZE }}>
        {/* Atmosphere glow */}
        <div
          className="absolute inset-0 pointer-events-none rounded-full"
          style={{ boxShadow: '0 0 80px #1a6aaa22, inset 0 0 60px #0d3a6618' }}
        />
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerLeave={endDrag}
          width={GLOBE_SIZE}
          height={GLOBE_SIZE}
          style={{
            width: GLOBE_SIZE,
            height: GLOBE_SIZE,
            cursor: 'grab',
            opacity: 0,
            transition: 'opacity 0.6s ease',
            contain: 'layout paint size',
            touchAction: 'none',
          }}
        />

        {/* Flag-emoji markers (positioned imperatively by the render loop) */}
        <div className="absolute inset-0 pointer-events-none">
          {REGION_ORDER.map((rid) => {
            const def = REGIONS[rid];
            const rs = state.regions[rid];
            const isActive = rid === activeRegion;
            const total = regionTotal(state, rid);
            const idx = REGION_ORDER.indexOf(rid);
            const floatClass = `icon-float-${(idx % 3) + 1}`;
            const fontSize =
              (rs.unlocked ? 44 : 40) +
              (rs.unlocked ? Math.min(16, total * 0.3) : 0) +
              (isActive ? 8 : 0);

            return (
              <button
                key={rid}
                ref={setFlagRef(rid)}
                onClick={() => rs.unlocked && onSelectRegion(rid)}
                aria-label={def.name}
                className="group absolute left-0 top-0 will-change-transform"
                style={{ opacity: 0, cursor: rs.unlocked ? 'pointer' : 'default' }}
              >
                {/* Pulse ring on the active region */}
                {isActive && rs.unlocked && (
                  <span
                    className="marker-pulse absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
                    style={{ width: 62, height: 62, border: `2px solid ${def.color}` }}
                  />
                )}

                {/* Hover-scale layer — kept separate so it doesn't fight the idle float */}
                <span className="relative block transition-transform duration-200 ease-out group-hover:scale-125">
                  {/* The flag (staggered idle float animation) */}
                  <span
                    className={`relative block leading-none ${isActive ? 'marker-bob' : floatClass}`}
                    style={{
                      fontSize,
                      animationDelay: `${idx * 0.4}s`,
                      filter: rs.unlocked
                        ? `drop-shadow(0 2px 5px #000b) drop-shadow(0 0 8px ${def.color}${isActive ? 'dd' : '66'})`
                        : 'grayscale(0.5) drop-shadow(0 2px 5px #000b)',
                    }}
                  >
                    {REGION_FLAG[rid]}

                    {/* Lock badge */}
                    {!rs.unlocked && (
                      <span className="absolute -bottom-1 -right-1.5 text-[13px] drop-shadow">🔒</span>
                    )}

                    {/* Datacenter count badge */}
                    {rs.unlocked && total > 0 && (
                      <span
                        className="absolute -top-1 -right-2 rounded-full px-1 font-mono text-[10px] font-bold text-black"
                        style={{ background: def.color }}
                      >
                        {total >= 1000 ? `${(total / 1000).toFixed(1)}k` : total}
                      </span>
                    )}
                  </span>
                </span>

                {/* Hover label */}
                <span
                  className="pointer-events-none absolute left-1/2 top-full -translate-x-1/2 mt-1 whitespace-nowrap rounded-md bg-surface/90 px-2 py-0.5 text-[10px] font-semibold text-fg opacity-0 transition-opacity group-hover:opacity-100"
                  style={{ border: `1px solid ${def.color}` }}
                >
                  {rs.unlocked ? def.name : `🔒 ${def.name} · ${formatEuros(def.unlockCost)}`}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Region selector chips */}
      <div className="flex flex-wrap items-center justify-center gap-2 max-w-140">
        {REGION_ORDER.map((rid) => {
          const def = REGIONS[rid];
          const rs = state.regions[rid];
          const isActive = rid === activeRegion;
          const total = regionTotal(state, rid);
          return (
            <button
              key={rid}
              disabled={!rs.unlocked}
              onClick={() => rs.unlocked && onSelectRegion(rid)}
              className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-all"
              style={{
                background: isActive ? `${def.color}22` : 'var(--gray-a2)',
                border: `1px solid ${isActive ? def.color : 'var(--gray-6)'}`,
                color: isActive ? def.color : rs.unlocked ? 'var(--gray-11)' : 'var(--gray-8)',
                opacity: rs.unlocked ? 1 : 0.5,
                cursor: rs.unlocked ? 'pointer' : 'not-allowed',
                boxShadow: isActive ? `0 0 12px ${def.color}55` : 'none',
              }}
            >
              <span className="text-sm leading-none">{REGION_FLAG[rid]}</span>
              {def.name}
              {rs.unlocked ? (
                total > 0 && (
                  <span
                    className="rounded-full px-1.5 font-mono text-[10px] text-black"
                    style={{ background: def.color }}
                  >
                    {total >= 1000 ? `${(total / 1000).toFixed(1)}k` : total}
                  </span>
                )
              ) : (
                <span className="text-[10px] opacity-70">🔒</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active region datacenter loadout */}
      <div className="flex items-center gap-2 h-6">
        {COMPONENT_ORDER.filter((t) => state.regions[activeRegion].components[t] > 0).map((t) => (
          <div key={t} className="flex items-center gap-1 text-[11px] text-muted">
            <img src={`/assets/${t}.svg`} alt={COMPONENTS[t].name} width={16} height={16} draggable={false} />
            <span className="font-mono">{state.regions[activeRegion].components[t]}</span>
          </div>
        ))}
      </div>

      {/* Deploy button */}
      <motion.button
        whileTap={{ scale: 0.93 }}
        onClick={handleClickBtn}
        className="relative flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-black focus:outline-none overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #ff9a33, #f36f14)',
          boxShadow: '0 0 30px #ff9a3340, 0 4px 20px #00000060',
        }}
        aria-label="Click to earn"
      >
        {/* Shimmer sweep */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.18) 50%, transparent 60%)' }}
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 1.5, ease: 'easeInOut' }}
        />
        <img src="/assets/click-icon.svg" alt="" width={24} height={24} className="drop-shadow" />
        <span className="text-lg tracking-wide">DEPLOY</span>
        <span className="text-sm font-normal opacity-80">+{formatEuros(state.clickValue)}</span>
      </motion.button>

      {/* Active region hint */}
      <div className="text-faint text-xs text-center -mt-2">
        région active :{' '}
        <span className="font-semibold" style={{ color: REGIONS[activeRegion].color }}>
          {REGIONS[activeRegion].name}
        </span>
        {' — cliquer un drapeau ou glisser pour tourner 🌍'}
      </div>
    </div>
  );
}

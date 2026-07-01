'use client';

import { useEffect, useRef, useMemo, useCallback } from 'react';
import createGlobe from 'cobe';
import type { Arc } from 'cobe';
import {
  REGIONS,
  REGION_ORDER,
  type ComponentType,
  type RegionId,
  type FullGameState,
} from '@/lib/game-engine';

// ── Globe geometry ─────────────────────────────────────────────
const GLOBE_SIZE = 600;
const CENTER = GLOBE_SIZE / 2;
const RADIUS_PX = GLOBE_SIZE * 0.46;

const COMPONENT_ORDER: ComponentType[] = ['cpu', 'ram', 'gpu', 'power', 'bandwidth', 'container'];

const REGION_LOCATION: Record<RegionId, [number, number]> = {
  uae:    [25.20,  55.27],
  eu:     [50.11,   8.68],
  us:     [38.90, -77.04],
  sea:    [ 1.35, 103.82],
  brazil: [-23.55, -46.63],
};

const REGION_FLAG: Record<RegionId, string> = {
  uae: '🇦🇪', eu: '🇪🇺', us: '🇺🇸', sea: '🇸🇬', brazil: '🇧🇷',
};

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
const REGION_RGB: Record<RegionId, [number, number, number]> = {
  uae: hexToRgb(REGIONS.uae.color), eu: hexToRgb(REGIONS.eu.color), us: hexToRgb(REGIONS.us.color),
  sea: hexToRgb(REGIONS.sea.color), brazil: hexToRgb(REGIONS.brazil.color),
};

const D = Math.PI / 180;

function locationToAngles(lat: number, lng: number): [number, number] {
  return [Math.PI - lng * D - Math.PI / 2, lat * D];
}

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

function buildArcs(state: FullGameState, active: RegionId): Arc[] {
  if (!state.regions[active].unlocked) return [];
  return REGION_ORDER.filter((rid) => rid !== active && state.regions[rid].unlocked).map((rid) => ({
    from: REGION_LOCATION[active],
    to: REGION_LOCATION[rid],
    color: REGION_RGB[active],
  }));
}

interface Props {
  state: FullGameState;
  activeRegion: RegionId;
  onSelectRegion: (id: RegionId) => void;
}

export default function PlanetView({ state, activeRegion, onSelectRegion }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phiRef = useRef(0);
  const thetaRef = useRef(0.2);
  const targetPhiRef = useRef(0);
  const targetThetaRef = useRef(0.2);
  const draggingRef = useRef(false);
  const dragPrevRef = useRef<{ x: number; y: number } | null>(null);
  const flagRefs = useRef<Partial<Record<RegionId, HTMLButtonElement>>>({});
  const arcsRef = useRef<Arc[]>(buildArcs(state, activeRegion));
  const dirtyRef = useRef(false);

  const arcSig = useMemo(
    () => REGION_ORDER.map((rid) => (state.regions[rid].unlocked ? 1 : 0)).join('') + activeRegion,
    [state, activeRegion],
  );

  useEffect(() => {
    arcsRef.current = buildArcs(state, activeRegion);
    dirtyRef.current = true;
  }, [arcSig]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const [p, t] = locationToAngles(...REGION_LOCATION[activeRegion]);
    targetPhiRef.current = nearestAngle(targetPhiRef.current, p);
    targetThetaRef.current = clamp(t, -0.5, 0.5);
  }, [activeRegion]);

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
      markers: [],
      arcs: arcsRef.current,
      arcColor: [1.0, 0.6, 0.2],
      arcWidth: 0.4,
      arcHeight: 0.35,
      markerElevation: 0.02,
    });

    const loop = () => {
      if (!draggingRef.current) targetPhiRef.current += 0.0025;
      phiRef.current += (targetPhiRef.current - phiRef.current) * 0.12;
      thetaRef.current += (targetThetaRef.current - thetaRef.current) * 0.12;

      const update: Parameters<typeof globe.update>[0] = { phi: phiRef.current, theta: thetaRef.current };
      if (dirtyRef.current) {
        update.arcs = arcsRef.current;
        dirtyRef.current = false;
      }
      globe.update(update);

      for (const rid of REGION_ORDER) {
        const el = flagRefs.current[rid];
        if (!el) continue;
        const { x, y, z } = projectRegion(rid, phiRef.current, thetaRef.current);
        const scale = 0.72 + 0.28 * Math.max(0, z);
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
    <div className="breathe relative" style={{ width: GLOBE_SIZE, height: GLOBE_SIZE }}>
      {/* atmosphere glow */}
      <div
        className="pointer-events-none absolute rounded-full"
        style={{ inset: -40, boxShadow: '0 0 120px 10px #2b6fff22, inset 0 0 90px #0d3a6620' }}
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
          width: GLOBE_SIZE, height: GLOBE_SIZE, cursor: 'grab', opacity: 0,
          transition: 'opacity 0.6s ease', contain: 'layout paint size', touchAction: 'none',
        }}
      />

      {/* flag markers projected onto the globe */}
      <div className="absolute inset-0 pointer-events-none">
        {REGION_ORDER.map((rid) => {
          const def = REGIONS[rid];
          const rs = state.regions[rid];
          const isActive = rid === activeRegion;
          const total = regionTotal(state, rid);
          const idx = REGION_ORDER.indexOf(rid);
          const floatClass = `icon-float-${(idx % 3) + 1}`;
          const fontSize =
            (rs.unlocked ? 44 : 40) + (rs.unlocked ? Math.min(16, total * 0.3) : 0) + (isActive ? 8 : 0);

          return (
            <button
              key={rid}
              ref={setFlagRef(rid)}
              onClick={() => rs.unlocked && onSelectRegion(rid)}
              aria-label={def.name}
              className="group absolute left-0 top-0 will-change-transform"
              style={{ opacity: 0, cursor: rs.unlocked ? 'pointer' : 'default' }}
            >
              {isActive && rs.unlocked && (
                <span
                  className="marker-pulse absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
                  style={{ width: 62, height: 62, border: `2px solid ${def.color}` }}
                />
              )}
              <span className="relative block transition-transform duration-200 ease-out group-hover:scale-125">
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
                  {!rs.unlocked && (
                    <span className="absolute -bottom-1 -right-1.5 text-[13px] drop-shadow">🔒</span>
                  )}
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
              <span
                className="pointer-events-none absolute left-1/2 top-full -translate-x-1/2 mt-1 whitespace-nowrap rounded-md bg-surface/90 px-2 py-0.5 text-[10px] font-semibold text-fg opacity-0 transition-opacity group-hover:opacity-100"
                style={{ border: `1px solid ${def.color}` }}
              >
                {rs.unlocked ? def.name : `🔒 ${def.name}`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

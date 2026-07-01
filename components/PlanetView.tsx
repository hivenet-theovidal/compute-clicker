'use client';

import { useEffect, useRef, useMemo, useCallback } from 'react';
import createGlobe from 'cobe';
import type { Arc } from 'cobe';
import {
  COMPONENTS,
  REGIONS,
  REGION_ORDER,
  type ComponentType,
  type RegionId,
  type FullGameState,
} from '@/lib/game-engine';
import { COMPONENT_META } from './UpgradeNode';

// ── Globe geometry ─────────────────────────────────────────────
const GLOBE_SIZE = 600;
const CENTER = GLOBE_SIZE / 2;
const RADIUS_PX = GLOBE_SIZE * 0.46;
const TILE = 32;

const COMPONENT_ORDER: ComponentType[] = ['cpu', 'ram', 'gpu', 'power', 'bandwidth', 'container'];

const REGION_LOCATION: Record<RegionId, [number, number]> = {
  uae:    [25.20,  55.27],
  eu:     [50.11,   8.68],
  us:     [38.90, -77.04],
  sea:    [ 1.35, 103.82],
  brazil: [-23.55, -46.63],
};

const REGION_IMAGE: Record<RegionId, string> = {
  uae: 'uae', eu: 'france', us: 'usa', sea: 'asia', brazil: 'brazil',
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
  const compRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const arcsRef = useRef<Arc[]>(buildArcs(state, activeRegion));
  const dirtyRef = useRef(false);

  // Owned component types per region — kept in a ref so the RAF loop can fan them.
  const ownedTypesRef = useRef<Record<RegionId, ComponentType[]>>({ uae: [], eu: [], us: [], sea: [], brazil: [] });
  const ownedTypes = {} as Record<RegionId, ComponentType[]>;
  for (const rid of REGION_ORDER) ownedTypes[rid] = COMPONENT_ORDER.filter((t) => state.regions[rid].components[t] > 0);
  ownedTypesRef.current = ownedTypes;

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

      const phi = phiRef.current, theta = thetaRef.current;
      for (const rid of REGION_ORDER) {
        const { x, y, z } = projectRegion(rid, phi, theta);
        const depth = Math.max(0, z);
        const dscale = 0.72 + 0.28 * depth;
        const opacity = String(clamp(z / 0.16, 0, 1));
        const zi = Math.round((z + 1) * 100);

        // region flag
        const el = flagRefs.current[rid];
        if (el) {
          el.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${dscale})`;
          el.style.opacity = opacity;
          el.style.zIndex = String(zi);
          el.style.pointerEvents = z > 0.05 ? 'auto' : 'none';
        }

        // fan owned component tiles outward from the globe centre
        const types = ownedTypesRef.current[rid];
        const n = types.length;
        if (n > 0) {
          // Fan outward from the globe centre; pin a stable angle when the region
          // sits dead-centre (focused/active) so the tiles don't jitter.
          const dx0 = x - CENTER, dy0 = y - CENTER;
          const outward = Math.hypot(dx0, dy0) < 26 ? Math.PI * 0.3 : Math.atan2(dy0, dx0);
          const spread = n === 1 ? 0 : n <= 3 ? Math.PI * 0.42 : Math.PI * 0.9;
          const ring = (56 + n * 4) * dscale;
          for (let i = 0; i < n; i++) {
            const tile = compRefs.current[`${rid}:${types[i]}`];
            if (!tile) continue;
            const t = n === 1 ? 0 : i / (n - 1) - 0.5;
            const ang = outward + t * spread;
            const cx = x + Math.cos(ang) * ring;
            const cy = y + Math.sin(ang) * ring;
            tile.style.transform = `translate(-50%, -50%) translate(${cx}px, ${cy}px) scale(${dscale})`;
            tile.style.opacity = opacity;
            tile.style.zIndex = String(zi - 1);
          }
        }
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
        style={{ inset: -40, boxShadow: '0 0 97px 8px #2b6fff1c, inset 0 0 73px #0d3a661a' }}
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

      {/* region flags + datacenter component tiles projected onto the globe */}
      <div className="absolute inset-0 pointer-events-none">
        {REGION_ORDER.map((rid) => {
          const def = REGIONS[rid];
          const rs = state.regions[rid];
          const isActive = rid === activeRegion;
          const total = regionTotal(state, rid);
          const idx = REGION_ORDER.indexOf(rid);
          const floatClass = `icon-float-${(idx % 3) + 1}`;
          const size =
            (rs.unlocked ? 75 : 60) + (rs.unlocked ? Math.min(16, total * 0.3) : 0) + (isActive ? 8 : 0);

          return (
            <div key={rid} className="contents">
              {/* component datacenter tiles */}
              {ownedTypes[rid].map((type, i) => {
                const count = rs.components[type];
                const meta = COMPONENT_META[type];
                return (
                  <div
                    key={type}
                    ref={(el) => { compRefs.current[`${rid}:${type}`] = el; }}
                    className="absolute left-0 top-0 pointer-events-none will-change-transform"
                    style={{ opacity: 0 }}
                  >
                    {/* entry pop (plays once on first purchase) */}
                    <div className="node-pop">
                      <div className={`icon-float-${(i % 3) + 1}`} style={{ animationDelay: `${i * 0.25}s` }}>
                        <div
                          className="relative grid place-items-center rounded-lg"
                          style={{
                            width: TILE, height: TILE,
                            background: 'linear-gradient(160deg, #0e1a2ef2, #0a1220f2)',
                            border: `1px solid ${def.color}66`,
                            boxShadow: `0 0 ${Math.min(4 + count * 0.5, 16)}px ${def.color}77, inset 0 0 12px -7px ${meta.color}`,
                          }}
                        >
                          <img
                            src={`/assets/${type}.svg`}
                            alt={COMPONENTS[type].name}
                            width={Math.round(TILE * 0.6)}
                            height={Math.round(TILE * 0.6)}
                            draggable={false}
                            style={{ filter: `drop-shadow(0 0 4px ${meta.color}bb)` }}
                          />
                          <div
                            className="absolute -top-1.5 -right-1.5 grid place-items-center rounded-full font-bold text-black"
                            style={{
                              minWidth: 15, height: 15, paddingInline: 2,
                              background: def.color, fontSize: count >= 100 ? 7 : 9,
                              boxShadow: `0 0 6px ${def.color}`,
                            }}
                          >
                            {count >= 1000 ? `${(count / 1000).toFixed(1)}k` : count}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* region flag */}
              <button
                ref={setFlagRef(rid)}
                onClick={() => onSelectRegion(rid)}
                aria-label={def.name}
                className="group absolute left-0 top-0 will-change-transform"
                style={{ opacity: 0, cursor: 'pointer' }}
              >
                {isActive && (
                  <span
                    className="marker-pulse absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
                    style={{ width: 62, height: 62, border: `2px solid ${def.color}` }}
                  />
                )}
                {!isActive && !rs.unlocked && (
                  <span
                    className="glow-pulse absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
                    style={{ width: 50, height: 50, background: `radial-gradient(circle, ${def.color}33, transparent 70%)`, boxShadow: `0 0 16px 2px ${def.color}44` }}
                  />
                )}
                <span className="relative block transition-transform duration-200 ease-out group-hover:scale-125">
                  <span
                    className={`relative block leading-none ${isActive ? 'marker-bob' : floatClass}`}
                    style={{ animationDelay: `${idx * 0.4}s` }}
                  >
                    <img
                      src={`/images/countries/${REGION_IMAGE[rid]}.png`}
                      alt={def.name}
                      width={size}
                      height={size}
                      draggable={false}
                      className="block object-contain"
                      style={{
                        filter: rs.unlocked
                          ? `drop-shadow(0 2px 5px #000b) drop-shadow(0 0 8px ${def.color}${isActive ? 'dd' : '66'})`
                          : 'grayscale(1) brightness(0.65) drop-shadow(0 2px 5px #000b)',
                      }}
                    />
                    {!rs.unlocked && (
                      <span className="absolute -bottom-1 -right-1.5 text-[13px] drop-shadow">🔒</span>
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
            </div>
          );
        })}
      </div>
    </div>
  );
}

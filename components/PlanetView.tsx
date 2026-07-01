'use client';

import { useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
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

// ── Geometry ───────────────────────────────────────────────────
// PLANET_R drives all other dimensions; change one number to resize.
const PLANET_R  = 200;
const S         = PLANET_R / 150;   // scale relative to original design
const CONTAINER = Math.round(680 * S / (200 / 150));  // ~680
const C         = CONTAINER / 2;

// ── Region geographic positions (already scaled) ───────────────
const REGION_GEO: Record<RegionId, { x: number; y: number; label: string }> = {
  us:     { x: Math.round(-82  * S), y: Math.round(-28 * S), label: 'US'     },
  eu:     { x: Math.round(-8   * S), y: Math.round(-60 * S), label: 'EU'     },
  brazil: { x: Math.round(-48  * S), y: Math.round( 62 * S), label: 'Brazil' },
  uae:    { x: Math.round( 38  * S), y: Math.round(-18 * S), label: 'UAE'    },
  sea:    { x: Math.round( 95  * S), y: Math.round( 20 * S), label: 'SEA'    },
};

const COMPONENT_ORDER: ComponentType[] = ['cpu', 'ram', 'gpu', 'power', 'bandwidth', 'container'];

// ── Fan layout for component icons around a region marker ──────
function componentPositions(
  rx: number, ry: number,
  ownedTypes: ComponentType[],
  iconSize: number,
): { type: ComponentType; x: number; y: number }[] {
  const n = ownedTypes.length;
  if (n === 0) return [];
  const outwardAngle = Math.atan2(ry, rx);
  const spread = n === 1 ? 0 : n <= 3 ? Math.PI / 3 : Math.PI * 0.78;
  const radius = iconSize * 1.4 + 12;
  return ownedTypes.map((type, i) => {
    const t = n === 1 ? 0 : (i / (n - 1)) - 0.5;
    const angle = outwardAngle + t * spread;
    return { type, x: rx + Math.cos(angle) * radius, y: ry + Math.sin(angle) * radius };
  });
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

  // Icon size: shrinks gracefully as more types are owned
  const totalOwnedTypes = useMemo(() => {
    let t = 0;
    for (const rid of REGION_ORDER)
      t += Object.values(state.regions[rid].components).filter(v => v > 0).length;
    return t;
  }, [state.regions]);

  const iconSize = Math.round(Math.max(18, Math.min(34, 34 - totalOwnedTypes * 0.4)));

  // Translate a coordinate from the original 150-radius design to the current scale
  const p = (v: number) => Math.round(C + v * S);

  return (
    <div className="flex flex-col items-center gap-4 select-none w-full pt-6 pb-4">
      {/* Balance + eps */}
      <div className="text-center">
        <motion.div
          key={Math.floor(state.balance / 0.5)}
          initial={{ scale: 1.04 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.12 }}
          className="text-5xl font-bold text-yellow-400 tabular-nums"
        >
          {formatEuros(state.balance)}
        </motion.div>
        <div className="text-slate-400 text-base mt-1">{formatEuros(eps)}/s</div>
      </div>

      {/* Planet canvas */}
      <div
        className="relative flex-shrink-0"
        style={{ width: CONTAINER, height: CONTAINER }}
      >
        {/* ── Planet SVG ── */}
        <svg
          className="absolute inset-0 pointer-events-none"
          width={CONTAINER}
          height={CONTAINER}
          viewBox={`0 0 ${CONTAINER} ${CONTAINER}`}
        >
          <defs>
            <radialGradient id="pg-ocean" cx="40%" cy="35%">
              <stop offset="0%"   stopColor="#1a4a7a" />
              <stop offset="50%"  stopColor="#0d2d52" />
              <stop offset="100%" stopColor="#040f1e" />
            </radialGradient>
            <radialGradient id="pg-atmo" cx="50%" cy="50%">
              <stop offset="68%" stopColor="transparent" />
              <stop offset="100%" stopColor="#4a90d9" stopOpacity="0.18" />
            </radialGradient>
            <clipPath id="pg-clip">
              <circle cx={C} cy={C} r={PLANET_R} />
            </clipPath>
          </defs>

          {/* Ocean */}
          <circle cx={C} cy={C} r={PLANET_R} fill="url(#pg-ocean)" />

          {/* Continents — coordinates scaled inline via p() helper */}
          <g clipPath="url(#pg-clip)" opacity="0.85">
            {/* North America */}
            <path
              d={`M ${p(-112)},${p(-98)} Q ${p(-128)},${p(-75)} ${p(-122)},${p(-45)}
                  Q ${p(-118)},${p(-20)} ${p(-100)},${p(-8)}
                  Q ${p(-85)},${p(-2)} ${p(-75)},${p(-18)}
                  Q ${p(-65)},${p(-35)} ${p(-62)},${p(-62)}
                  Q ${p(-55)},${p(-90)} ${p(-78)},${p(-105)}
                  Q ${p(-95)},${p(-112)} ${p(-112)},${p(-98)} Z`}
              fill="#3d7228"
            />
            {/* Greenland */}
            <ellipse cx={p(-68)} cy={p(-108)} rx={Math.round(22*S)} ry={Math.round(16*S)} fill="#4a7a30" opacity="0.7"/>
            {/* South America */}
            <path
              d={`M ${p(-60)},${p(28)} Q ${p(-72)},${p(32)} ${p(-75)},${p(55)}
                  Q ${p(-76)},${p(80)} ${p(-62)},${p(100)}
                  Q ${p(-50)},${p(115)} ${p(-38)},${p(108)}
                  Q ${p(-22)},${p(98)} ${p(-20)},${p(75)}
                  Q ${p(-18)},${p(50)} ${p(-30)},${p(30)}
                  Q ${p(-42)},${p(18)} ${p(-60)},${p(28)} Z`}
              fill="#3d7228"
            />
            {/* Europe */}
            <path
              d={`M ${p(-28)},${p(-80)} Q ${p(-20)},${p(-92)} ${p(-5)},${p(-88)}
                  Q ${p(8)},${p(-84)} ${p(12)},${p(-72)}
                  Q ${p(18)},${p(-58)} ${p(8)},${p(-48)}
                  Q ${p(-2)},${p(-40)} ${p(-15)},${p(-42)}
                  Q ${p(-28)},${p(-44)} ${p(-35)},${p(-58)}
                  Q ${p(-38)},${p(-70)} ${p(-28)},${p(-80)} Z`}
              fill="#3d7228"
            />
            {/* Scandinavia */}
            <path
              d={`M ${p(-5)},${p(-92)} Q ${p(5)},${p(-105)} ${p(10)},${p(-95)}
                  Q ${p(12)},${p(-80)} ${p(8)},${p(-72)}
                  Q ${p(2)},${p(-72)} ${p(-5)},${p(-80)} Z`}
              fill="#3d7228"
            />
            {/* Africa */}
            <path
              d={`M ${p(-18)},${p(-40)} Q ${p(2)},${p(-45)} ${p(20)},${p(-35)}
                  Q ${p(35)},${p(-22)} ${p(38)},${p(5)}
                  Q ${p(40)},${p(35)} ${p(28)},${p(72)}
                  Q ${p(18)},${p(100)} ${p(5)},${p(105)}
                  Q ${p(-10)},${p(108)} ${p(-20)},${p(90)}
                  Q ${p(-32)},${p(68)} ${p(-32)},${p(35)}
                  Q ${p(-32)},${p(5)} ${p(-22)},${p(-15)}
                  Q ${p(-15)},${p(-30)} ${p(-18)},${p(-40)} Z`}
              fill="#4a7a20"
            />
            {/* Arabian Peninsula */}
            <path
              d={`M ${p(22)},${p(-35)} Q ${p(42)},${p(-40)} ${p(55)},${p(-28)}
                  Q ${p(62)},${p(-15)} ${p(58)},${p(5)}
                  Q ${p(50)},${p(18)} ${p(38)},${p(12)}
                  Q ${p(30)},${p(5)} ${p(28)},${p(-10)}
                  Q ${p(24)},${p(-22)} ${p(22)},${p(-35)} Z`}
              fill="#5a7a20"
            />
            {/* Asia */}
            <path
              d={`M ${p(12)},${p(-88)} Q ${p(45)},${p(-105)} ${p(90)},${p(-95)}
                  Q ${p(128)},${p(-82)} ${p(138)},${p(-58)}
                  Q ${p(145)},${p(-35)} ${p(135)},${p(-10)}
                  Q ${p(120)},${p(18)} ${p(95)},${p(22)}
                  Q ${p(72)},${p(25)} ${p(58)},${p(5)}
                  Q ${p(42)},${p(-15)} ${p(40)},${p(-38)}
                  Q ${p(38)},${p(-58)} ${p(22)},${p(-68)}
                  Q ${p(14)},${p(-78)} ${p(12)},${p(-88)} Z`}
              fill="#3d7228"
            />
            {/* India */}
            <path
              d={`M ${p(62)},${p(5)} Q ${p(72)},${p(8)} ${p(78)},${p(28)}
                  Q ${p(80)},${p(48)} ${p(68)},${p(62)}
                  Q ${p(58)},${p(72)} ${p(50)},${p(58)}
                  Q ${p(46)},${p(40)} ${p(48)},${p(18)}
                  Q ${p(52)},${p(5)} ${p(62)},${p(5)} Z`}
              fill="#3d7228"
            />
            {/* Indochina / SEA */}
            <path
              d={`M ${p(95)},${p(22)} Q ${p(118)},${p(15)} ${p(132)},${p(32)}
                  Q ${p(140)},${p(48)} ${p(128)},${p(58)}
                  Q ${p(112)},${p(65)} ${p(100)},${p(55)}
                  Q ${p(88)},${p(45)} ${p(88)},${p(30)}
                  Q ${p(90)},${p(22)} ${p(95)},${p(22)} Z`}
              fill="#3d7228"
            />
            {/* Indonesian islands */}
            <ellipse cx={p(120)} cy={p(75)} rx={Math.round(28*S)} ry={Math.round(8*S)} fill="#3d7228" opacity="0.85"/>
            <ellipse cx={p(150)} cy={p(83)} rx={Math.round(14*S)} ry={Math.round(6*S)} fill="#3d7228" opacity="0.75"/>
            {/* Australia */}
            <path
              d={`M ${p(108)},${p(98)} Q ${p(128)},${p(90)} ${p(148)},${p(98)}
                  Q ${p(162)},${p(108)} ${p(158)},${p(125)}
                  Q ${p(148)},${p(140)} ${p(128)},${p(142)}
                  Q ${p(108)},${p(138)} ${p(98)},${p(122)}
                  Q ${p(92)},${p(108)} ${p(108)},${p(98)} Z`}
              fill="#5a7a20"
            />
          </g>

          {/* Atmosphere + specular */}
          <circle cx={C} cy={C} r={PLANET_R} fill="url(#pg-atmo)" />
          <ellipse cx={C - Math.round(55*S)} cy={C - Math.round(65*S)}
                   rx={Math.round(55*S)} ry={Math.round(30*S)}
                   fill="white" opacity="0.04" />
          <circle cx={C} cy={C} r={PLANET_R} fill="none" stroke="#1a3a5c" strokeWidth="1.5" />
        </svg>

        {/* ── Atmosphere glow ring ── */}
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            left: C - PLANET_R - 18, top: C - PLANET_R - 18,
            width: (PLANET_R + 18) * 2, height: (PLANET_R + 18) * 2,
            boxShadow: '0 0 60px #1a6aaa28, 0 0 120px #0d3a6618',
            border: '1px solid #1a4a7a22',
            borderRadius: '50%',
          }}
        />

        {/* ── Region markers + component icons ── */}
        {REGION_ORDER.map((rid) => {
          const geo       = REGION_GEO[rid];
          const regionDef = REGIONS[rid];
          const rs        = state.regions[rid];
          const isActive  = rid === activeRegion;
          const isUnlocked = rs.unlocked;

          const ownedTypes = COMPONENT_ORDER.filter(t => rs.components[t] > 0);
          const positions  = componentPositions(geo.x, geo.y, ownedTypes, iconSize);
          const regionIdx  = REGION_ORDER.indexOf(rid);

          return (
            <div key={rid}>
              {/* Component icons */}
              {positions.map(({ type, x, y }) => {
                const count    = rs.components[type];
                const def      = COMPONENTS[type];
                const sz       = Math.round(Math.min(iconSize + Math.log(count + 1) * 3, iconSize + 14));
                const floatIdx = regionIdx * COMPONENT_ORDER.length + COMPONENT_ORDER.indexOf(type);
                const variant  = (floatIdx % 3) + 1;                     // 1, 2 or 3
                const delay    = ((floatIdx % 9) * 0.38).toFixed(2);     // 0 – 3.04 s

                return (
                  <motion.div
                    key={type}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    className="absolute pointer-events-none"
                    style={{ left: C + x - sz / 2, top: C + y - sz / 2 }}
                  >
                    {/* Float wrapper — CSS animation so it doesn't conflict with Framer entry */}
                    <div
                      className={`icon-float-${variant}`}
                      style={{ animationDelay: `${delay}s` }}
                    >
                      <div
                        className="relative rounded-lg flex items-center justify-center"
                        style={{
                          width: sz, height: sz,
                          background: '#0a1829ee',
                          border: `1px solid ${regionDef.color}55`,
                          boxShadow: `0 0 ${Math.min(count * 0.6, 18)}px ${regionDef.color}65`,
                        }}
                      >
                        <Image
                          src={`/assets/${type}.svg`}
                          alt={def.name}
                          width={Math.round(sz * 0.62)}
                          height={Math.round(sz * 0.62)}
                          draggable={false}
                        />
                        <div
                          className="absolute -top-1.5 -right-1.5 rounded-full flex items-center justify-center font-bold text-black"
                          style={{
                            minWidth: 16, height: 16, paddingInline: 2,
                            background: regionDef.color,
                            fontSize: count >= 100 ? 7 : 9,
                          }}
                        >
                          {count >= 1000 ? `${(count / 1000).toFixed(1)}k` : count}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              {/* Region marker (clickable) */}
              <div
                className="absolute flex flex-col items-center gap-0.5 cursor-pointer z-10"
                style={{
                  left: C + geo.x - 22, top: C + geo.y - 22,
                  width: 44, height: 44,
                  opacity: isUnlocked ? 1 : 0.35,
                }}
                onClick={(e) => { e.stopPropagation(); if (isUnlocked) onSelectRegion(rid); }}
              >
                <div
                  className="rounded-full transition-all duration-300"
                  style={{
                    width:  isActive ? 12 : 8,
                    height: isActive ? 12 : 8,
                    marginTop: 16,
                    background: regionDef.color,
                    boxShadow: isActive
                      ? `0 0 10px ${regionDef.color}, 0 0 20px ${regionDef.color}80`
                      : `0 0 5px ${regionDef.color}80`,
                  }}
                />
                <div
                  className="font-bold whitespace-nowrap leading-none"
                  style={{
                    fontSize: 9,
                    color: isActive ? regionDef.color : '#94a3b8',
                    textShadow: '0 1px 4px #000',
                  }}
                >
                  {geo.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Dedicated click button ── */}
      <motion.button
        whileTap={{ scale: 0.93 }}
        onClick={handleClickBtn}
        className="relative flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-slate-900 focus:outline-none overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #facc15, #f97316)',
          boxShadow: '0 0 30px #facc1540, 0 4px 20px #00000060',
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
      <div className="text-slate-600 text-xs text-center -mt-2">
        région active :{' '}
        <span className="font-semibold" style={{ color: REGIONS[activeRegion].color }}>
          {REGIONS[activeRegion].name}
        </span>
        {' — cliquer sur un marqueur pour changer'}
      </div>
    </div>
  );
}

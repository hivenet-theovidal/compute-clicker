'use client';

import { useEffect, useRef } from 'react';

/**
 * Deep-space backdrop: parallax starfield (canvas) + drifting nebulae +
 * a couple of slow satellites. Purely decorative, sits behind everything.
 */
export default function GameBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const parallaxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0, h = 0;
    let stars: { x: number; y: number; z: number; r: number; tw: number; ph: number }[] = [];

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round((w * h) / 5200);
      stars = Array.from({ length: count }, (_, i) => ({
        x: Math.random() * w,
        y: Math.random() * h,
        z: Math.random() * 0.8 + 0.2,   // depth → size + parallax
        r: Math.random() * 1.3 + 0.3,
        tw: Math.random() * 0.8 + 0.2,  // twinkle speed
        ph: (i % 20) * 0.5,             // deterministic phase (no Math.random in loop)
      }));
    };
    resize();
    window.addEventListener('resize', resize);

    // pointer parallax
    let px = 0, py = 0, tx = 0, ty = 0;
    const onMove = (e: PointerEvent) => {
      tx = (e.clientX / w - 0.5) * 2;
      ty = (e.clientY / h - 0.5) * 2;
    };
    window.addEventListener('pointermove', onMove);

    let t = 0;
    let raf = 0;
    const loop = () => {
      t += 0.016;
      px += (tx - px) * 0.05;
      py += (ty - py) * 0.05;
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        const ox = px * s.z * 22;
        const oy = py * s.z * 22;
        const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * s.tw + s.ph));
        ctx.globalAlpha = a * s.z;
        // faint blue-white stars, a few warm ones
        ctx.fillStyle = s.ph % 5 < 1 ? '#ffd9a8' : '#cfe0ff';
        ctx.beginPath();
        ctx.arc(s.x + ox, s.y + oy, s.r * s.z, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      if (parallaxRef.current) {
        parallaxRef.current.style.transform = `translate3d(${px * -14}px, ${py * -14}px, 0)`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
    };
  }, []);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden" style={{ background: 'radial-gradient(140% 120% at 50% 30%, #0b1020 0%, #070912 55%, #04060d 100%)' }}>
      {/* Nebulae (parallax layer) */}
      <div ref={parallaxRef} className="absolute inset-0">
        <div
          className="nebula absolute rounded-full"
          style={{ left: '8%', top: '10%', width: 620, height: 620, background: 'radial-gradient(circle, rgba(61,99,221,0.22), transparent 62%)', filter: 'blur(30px)' }}
        />
        <div
          className="nebula absolute rounded-full"
          style={{ right: '4%', top: '30%', width: 720, height: 720, background: 'radial-gradient(circle, rgba(120,70,220,0.16), transparent 60%)', filter: 'blur(40px)', animationDelay: '-8s' }}
        />
        <div
          className="nebula absolute rounded-full"
          style={{ left: '30%', bottom: '-10%', width: 800, height: 500, background: 'radial-gradient(circle, rgba(255,120,40,0.10), transparent 60%)', filter: 'blur(50px)', animationDelay: '-14s' }}
        />
      </div>

      {/* Starfield */}
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* Vignette */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 120% at 50% 45%, transparent 55%, rgba(0,0,0,0.55) 100%)' }} />
    </div>
  );
}

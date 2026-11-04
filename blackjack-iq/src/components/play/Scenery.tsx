"use client";

// Procedural landscape backdrops for the tables. Everything is generated as SVG from seeded
// noise, so the scenes need no image files and look the same on every visit.

import { useId, useMemo } from "react";
import type { SceneId } from "@/lib/tables";

// Wide, tall canvas so the scene still fills the frame when it is raised behind the table.
const W = 2000;
const H = 1300;

/** Scene y (in canvas units) that should sit just above the table's far rail. */
export const SCENE_FOCUS: Record<SceneId, number> = { lake: 556, alpine: 500, beach: 560, aurora: 560 };
export const SCENE_HEIGHT = H;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Rolling ridge line by midpoint displacement, filled down to the bottom of the scene. */
function ridge(seed: number, baseY: number, amp: number, rough = 0.55, levels = 7, bottom = H): string {
  const r = mulberry32(seed);
  let pts = [baseY + (r() - 0.5) * amp, baseY + (r() - 0.5) * amp];
  let disp = amp;
  for (let l = 0; l < levels; l++) {
    const next: number[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i] as number;
      const b = pts[i + 1] as number;
      next.push(a, (a + b) / 2 + (r() - 0.5) * disp);
    }
    next.push(pts[pts.length - 1] as number);
    pts = next;
    disp *= rough;
  }
  const step = W / (pts.length - 1);
  return `M0,${bottom} ` + pts.map((y, i) => `L${(i * step).toFixed(1)},${y.toFixed(1)}`).join(" ") + ` L${W},${bottom} Z`;
}

type Peak = [x: number, height: number, halfWidth: number];

/** Jagged mountain range: triangular peaks plus fine noise. Returns the outline and a height function. */
function range(seed: number, baseY: number, peaks: Peak[], noise: number) {
  const r = mulberry32(seed);
  const n = 160;
  const ys: number[] = [];
  let drift = 0;
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * W;
    let h = 0;
    for (const [px, ph, pw] of peaks) h = Math.max(h, ph * Math.max(0, 1 - Math.abs(x - px) / pw));
    drift = drift * 0.6 + (r() - 0.5) * noise;
    ys.push(baseY - h + drift);
  }
  const d = `M0,${H} ` + ys.map((y, i) => `L${((i / n) * W).toFixed(1)},${y.toFixed(1)}`).join(" ") + ` L${W},${H} Z`;
  return { d, ys, n };
}

/** Snow cap: the part of a range above a wavy snow line. */
function snowCaps(ys: number[], n: number, peaks: Peak[], baseY: number, seed: number): string {
  const r = mulberry32(seed);
  let d = "";
  for (const [px, ph, pw] of peaks) {
    if (ph < 140) continue;
    const line = baseY - ph * 0.7;
    const i0 = Math.max(0, Math.floor(((px - pw) / W) * n));
    const i1 = Math.min(n, Math.ceil(((px + pw) / W) * n));
    const top: string[] = [];
    const under: string[] = [];
    for (let i = i0; i <= i1; i++) {
      const y = ys[i] as number;
      const x = (i / n) * W;
      const sl = line + Math.sin(i * 1.7) * 6 + (r() - 0.5) * 10;
      if (y < sl) {
        top.push(`${x.toFixed(1)},${y.toFixed(1)}`);
        under.unshift(`${x.toFixed(1)},${sl.toFixed(1)}`);
      }
    }
    if (top.length > 2) d += `M${top.join(" L")} L${under.join(" L")} Z `;
  }
  return d;
}

/** A line of pine trees standing on `groundY`. */
function pines(seed: number, groundY: number, count: number, minH: number, maxH: number, x0 = 0, x1 = W): string {
  const r = mulberry32(seed);
  let d = "";
  for (let i = 0; i < count; i++) {
    const x = x0 + ((i + r() * 0.8) / count) * (x1 - x0);
    const h = minH + r() * (maxH - minH);
    const w = h * (0.32 + r() * 0.1);
    const y = groundY + r() * 6;
    for (let t = 0; t < 3; t++) {
      const top = y - h + t * h * 0.22;
      const bw = w * (0.55 + t * 0.25);
      d += `M${x.toFixed(1)},${top.toFixed(1)} L${(x + bw / 2).toFixed(1)},${(top + h * 0.5).toFixed(1)} L${(x - bw / 2).toFixed(1)},${(top + h * 0.5).toFixed(1)} Z `;
    }
    d += `M${(x - w * 0.05).toFixed(1)},${(y - h * 0.1).toFixed(1)} h${(w * 0.1).toFixed(1)} V${(y + 4).toFixed(1)} h${(-w * 0.1).toFixed(1)} Z `;
  }
  return d;
}

/** Palm tree silhouette: curved trunk plus drooping fronds. */
function palm(x: number, baseY: number, height: number, lean: number, seed: number) {
  const r = mulberry32(seed);
  const topX = x + lean;
  const topY = baseY - height;
  const trunk = `M${x},${baseY} Q${x + lean * 0.15},${baseY - height * 0.55} ${topX},${topY}`;
  let fronds = "";
  const count = 8;
  for (let i = 0; i < count; i++) {
    const ang = -Math.PI + (i / (count - 1)) * Math.PI + (r() - 0.5) * 0.3;
    const len = height * (0.38 + r() * 0.14);
    const tipX = topX + Math.cos(ang) * len;
    const tipY = topY + Math.sin(ang) * len * 0.45 + len * 0.42;
    const midX = topX + Math.cos(ang) * len * 0.55;
    const midY = topY + Math.sin(ang) * len * 0.55 - len * 0.12;
    const w = len * 0.11;
    fronds += `M${topX},${topY} Q${midX},${midY - w} ${tipX},${tipY} Q${midX},${midY + w} ${topX},${topY + 4} Z `;
  }
  return { trunk, fronds };
}

function stars(seed: number, count: number, maxY: number) {
  const r = mulberry32(seed);
  return Array.from({ length: count }, (_, i) => ({ i, x: r() * W, y: r() * maxY, s: 0.6 + r() * 1.6, d: r() * 4 }));
}

/** Short horizontal glints on water, drawn under a light source. */
function glints(seed: number, cx: number, y0: number, y1: number, spread: number, count: number) {
  const r = mulberry32(seed);
  return Array.from({ length: count }, (_, i) => {
    const t = r();
    const y = y0 + t * (y1 - y0);
    const half = spread * (0.25 + t * 0.9);
    const x = cx + (r() - 0.5) * half * 2;
    return { i, x, y, w: 10 + r() * 40 * (0.4 + t), d: r() * 3 };
  });
}

function Lake({ p }: { p: string }) {
  const g = useMemo(
    () => ({
      far: ridge(11, 470, 90, 0.55),
      mid: ridge(23, 515, 60, 0.5),
      trees: pines(7, 548, 88, 22, 64),
      glints: glints(5, 1280, 560, 1000, 180, 90),
    }),
    [],
  );
  return (
    <>
      <defs>
        <linearGradient id={`${p}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1d1f4a" />
          <stop offset="0.38" stopColor="#5a3a78" />
          <stop offset="0.52" stopColor="#c46a7c" />
          <stop offset="0.62" stopColor="#f3a865" />
        </linearGradient>
        <linearGradient id={`${p}water`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e79a6e" />
          <stop offset="0.15" stopColor="#8a5a7e" />
          <stop offset="1" stopColor="#141533" />
        </linearGradient>
        <radialGradient id={`${p}sun`}>
          <stop offset="0" stopColor="#fff2c8" />
          <stop offset="0.25" stopColor="#ffd08a" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ff9a6a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${p}sky)`} />
      <circle cx="1280" cy="505" r="230" fill={`url(#${p}sun)`} />
      <circle cx="1280" cy="505" r="46" fill="#fff0c4" />
      <g className="scene-drift" opacity="0.5">
        <ellipse cx="620" cy="360" rx="260" ry="20" fill="#f6b48e" />
        <ellipse cx="1500" cy="410" rx="220" ry="14" fill="#f3a3a0" />
      </g>
      <path d={g.far} fill="#4b3a6e" opacity="0.85" />
      <path d={g.mid} fill="#2c2550" />
      <rect y="556" width={W} height={H - 556} fill={`url(#${p}water)`} />
      <g transform="translate(0 1112) scale(1 -1)" opacity="0.28">
        <path d={g.mid} fill="#2c2550" />
      </g>
      <path d={g.trees} fill="#141a2e" />
      <g className="scene-shimmer">
        {g.glints.map((s) => (
          <rect key={s.i} x={s.x} y={s.y} width={s.w} height="2.4" rx="1.2" fill="#ffd9a0" opacity="0.55" style={{ animationDelay: `${s.d}s` }} />
        ))}
      </g>
    </>
  );
}

const ALPINE_PEAKS: Peak[] = [
  [60, 180, 280],
  [400, 190, 300],
  [760, 250, 300],
  [1100, 180, 240],
  [1420, 270, 320],
  [1760, 200, 280],
  [2000, 170, 240],
];

function Alpine({ p }: { p: string }) {
  const g = useMemo(() => {
    const back = range(41, 600, ALPINE_PEAKS, 8);
    return {
      back: back.d,
      snow: snowCaps(back.ys, back.n, ALPINE_PEAKS, 600, 3),
      mid: range(42, 640, [[300, 110, 380], [1000, 90, 420], [1650, 120, 320]], 6).d,
      forest: pines(19, 670, 110, 30, 80),
      forest2: pines(29, 720, 70, 60, 130),
    };
  }, []);
  return (
    <>
      <defs>
        <linearGradient id={`${p}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2f5f95" />
          <stop offset="0.45" stopColor="#8fb6d8" />
          <stop offset="0.66" stopColor="#f2d2a8" />
        </linearGradient>
        <linearGradient id={`${p}rock`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#5b6f8e" />
          <stop offset="1" stopColor="#3d4d6a" />
        </linearGradient>
        <linearGradient id={`${p}mist`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dfe8f2" stopOpacity="0" />
          <stop offset="1" stopColor="#dfe8f2" stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id={`${p}snow`} x1="0" y1="0" x2="1" y2="0.3">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#ffd9b5" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${p}sky)`} />
      <g className="scene-drift" opacity="0.75">
        <ellipse cx="520" cy="350" rx="190" ry="24" fill="#ffffff" opacity="0.6" />
        <ellipse cx="640" cy="362" rx="140" ry="18" fill="#ffffff" opacity="0.5" />
        <ellipse cx="1420" cy="330" rx="240" ry="20" fill="#ffffff" opacity="0.45" />
      </g>
      <path d={g.back} fill={`url(#${p}rock)`} />
      <path d={g.snow} fill={`url(#${p}snow)`} />
      <rect y="470" width={W} height="200" fill={`url(#${p}mist)`} />
      <path d={g.mid} fill="#30435f" />
      <path d={g.forest} fill="#1c3328" />
      <path d={g.forest2} fill="#0f2119" />
      <rect y="720" width={W} height={H - 720} fill="#0f2119" />
    </>
  );
}

function Beach({ p }: { p: string }) {
  const g = useMemo(
    () => ({
      island: ridge(77, 548, 40, 0.5, 6),
      left: palm(330, 900, 470, 120, 3),
      left2: palm(520, 930, 360, 60, 9),
      right: palm(1660, 910, 500, -140, 4),
      glints: glints(8, 1000, 565, 900, 240, 100),
    }),
    [],
  );
  return (
    <>
      <defs>
        <linearGradient id={`${p}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a2a6e" />
          <stop offset="0.3" stopColor="#a8457a" />
          <stop offset="0.5" stopColor="#ff7f5c" />
          <stop offset="0.62" stopColor="#ffc46b" />
        </linearGradient>
        <linearGradient id={`${p}sea`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f39a6b" />
          <stop offset="0.12" stopColor="#5a5c8e" />
          <stop offset="1" stopColor="#123a5c" />
        </linearGradient>
        <linearGradient id={`${p}sand`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d79a6a" />
          <stop offset="1" stopColor="#8a5a3c" />
        </linearGradient>
        <radialGradient id={`${p}sun`}>
          <stop offset="0" stopColor="#fff4c2" />
          <stop offset="0.3" stopColor="#ffc06a" stopOpacity="0.85" />
          <stop offset="1" stopColor="#ff7f5c" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${p}above`}>
          <rect width={W} height="560" />
        </clipPath>
      </defs>
      <rect width={W} height={H} fill={`url(#${p}sky)`} />
      <circle cx="1000" cy="560" r="300" fill={`url(#${p}sun)`} />
      <circle cx="1000" cy="560" r="78" fill="#ffe7a8" clipPath={`url(#${p}above)`} />
      <g className="scene-drift" opacity="0.55">
        <ellipse cx="620" cy="370" rx="300" ry="12" fill="#ffb08a" />
        <ellipse cx="1380" cy="340" rx="260" ry="10" fill="#ff9ea0" />
        <ellipse cx="1100" cy="430" rx="200" ry="8" fill="#ffc58f" />
      </g>
      <path d={g.island} fill="#5b3a64" opacity="0.7" transform="translate(-300 0) scale(0.45 1)" />
      <rect y="560" width={W} height={H - 560} fill={`url(#${p}sea)`} />
      <g className="scene-shimmer">
        {g.glints.map((s) => (
          <rect key={s.i} x={s.x} y={s.y} width={s.w} height="2.6" rx="1.3" fill="#ffe1a6" opacity="0.6" style={{ animationDelay: `${s.d}s` }} />
        ))}
      </g>
      <g className="scene-waves" stroke="#ffd7b8" strokeOpacity="0.35" strokeWidth="2.5" fill="none">
        <path d="M-100,700 Q100,688 300,700 T700,700 T1100,700 T1500,700 T1900,700 T2300,700" />
        <path d="M-100,760 Q100,748 300,760 T700,760 T1100,760 T1500,760 T1900,760 T2300,760" />
        <path d="M-100,830 Q100,818 300,830 T700,830 T1100,830 T1500,830 T1900,830 T2300,830" />
      </g>
      <path d={`M0,880 Q500,840 1000,870 T2000,850 L2000,${H} L0,${H} Z`} fill={`url(#${p}sand)`} />
      {[g.left, g.left2, g.right].map((t, i) => (
        <g key={i} fill="#26142a">
          <path d={t.trunk} stroke="#26142a" strokeWidth={i === 1 ? 11 : 15} strokeLinecap="round" fill="none" />
          <path d={t.fronds} className="scene-sway" style={{ animationDelay: `${i * 0.7}s` }} />
        </g>
      ))}
    </>
  );
}

function Aurora({ p }: { p: string }) {
  const g = useMemo(
    () => ({
      stars: stars(13, 220, 560),
      left: range(61, 640, [[200, 300, 380], [520, 190, 240]], 12).d,
      right: range(62, 640, [[1820, 310, 360], [1480, 180, 220]], 12).d,
      back: ridge(64, 575, 50, 0.55),
      ribbons: [
        { d: "M-100,430 C300,330 650,480 1000,380 S1650,320 2100,420", w: 90, dur: 14 },
        { d: "M-100,370 C350,450 750,300 1100,360 S1700,460 2100,350", w: 60, dur: 18 },
        { d: "M100,500 C450,430 760,530 1180,460 S1700,400 2000,480", w: 50, dur: 22 },
      ],
    }),
    [],
  );
  return (
    <>
      <defs>
        <linearGradient id={`${p}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#030714" />
          <stop offset="0.55" stopColor="#0b1e35" />
          <stop offset="0.68" stopColor="#123049" />
        </linearGradient>
        <linearGradient id={`${p}band`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#3dffb0" stopOpacity="0" />
          <stop offset="0.25" stopColor="#3dffb0" />
          <stop offset="0.6" stopColor="#36e0d0" />
          <stop offset="0.85" stopColor="#9a6bff" />
          <stop offset="1" stopColor="#9a6bff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${p}water`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#123049" />
          <stop offset="1" stopColor="#020610" />
        </linearGradient>
        <filter id={`${p}blur`} x="-10%" y="-50%" width="120%" height="200%">
          <feGaussianBlur stdDeviation="22" />
        </filter>
      </defs>
      <rect width={W} height={H} fill={`url(#${p}sky)`} />
      <g>
        {g.stars.map((s) => (
          <circle key={s.i} cx={s.x} cy={s.y} r={s.s} fill="#eaf4ff" className="scene-twinkle" style={{ animationDelay: `${s.d}s` }} />
        ))}
      </g>
      <g filter={`url(#${p}blur)`} opacity="0.85">
        {g.ribbons.map((b, i) => (
          <path key={i} d={b.d} stroke={`url(#${p}band)`} strokeWidth={b.w} fill="none" className="scene-aurora" style={{ animationDuration: `${b.dur}s` }} />
        ))}
      </g>
      <path d={g.back} fill="#0b1a2c" />
      <path d={g.left} fill="#060e1b" />
      <path d={g.right} fill="#060e1b" />
      <rect y="600" width={W} height={H - 600} fill={`url(#${p}water)`} />
      <g transform="translate(0 1205) scale(1 -1)" opacity="0.4" filter={`url(#${p}blur)`}>
        {g.ribbons.slice(0, 2).map((b, i) => (
          <path key={i} d={b.d} stroke={`url(#${p}band)`} strokeWidth={b.w} fill="none" />
        ))}
      </g>
    </>
  );
}

export function Scenery({ scene, className = "" }: { scene: SceneId; className?: string }) {
  const p = useId().replace(/[^a-zA-Z0-9]/g, "") + scene;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className={className} aria-hidden data-scene={scene}>
      {scene === "lake" ? <Lake p={p} /> : scene === "alpine" ? <Alpine p={p} /> : scene === "beach" ? <Beach p={p} /> : <Aurora p={p} />}
    </svg>
  );
}

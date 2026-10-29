"use client";

import { useEffect, useId, useState } from "react";

/**
 * The wax seal: Sealed's one memorable visual.
 *   empty    – a dashed outline where the seal will go (no money held yet)
 *   pressed  – wax pressed onto the deal: the buyer's money is on hold
 *   cracked  – seal broken open: money released to the seller
 *   lifted   – seal lifted off intact: money returned to the buyer
 */
export type SealState = "empty" | "pressed" | "cracked" | "lifted";

const C = 100; // centre of the 200×200 viewBox

/** Irregular wax outline, deterministic so it never changes between renders. */
function blobPath(base = 80): string {
  const n = 36;
  const pts = Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    const r = base + 4.5 * Math.sin(5 * t + 0.7) + 2.6 * Math.sin(11 * t + 2.1) + 1.6 * Math.sin(17 * t + 0.3);
    return [C + r * Math.cos(t), C + r * Math.sin(t)] as const;
  });
  // Closed Catmull-Rom spline converted to cubic Béziers for a soft, poured edge.
  let d = `M${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(2)},${c1[1].toFixed(2)} ${c2[0].toFixed(2)},${c2[1].toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  return d + "Z";
}

const BLOB = blobPath();
const CRACK = [
  [104, 0],
  [104, 14],
  [95, 44],
  [109, 74],
  [93, 106],
  [107, 138],
  [96, 170],
  [101, 200],
];
const crackLine = CRACK.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join(" ");
const leftClip = `M0,0 ${CRACK.map((p) => `L${p[0]},${p[1]}`).join(" ")} L0,200 Z`;
const rightClip = `M200,0 ${CRACK.map((p) => `L${p[0]},${p[1]}`).join(" ")} L200,200 Z`;

function SealArt({ uid, monogram }: { uid: string; monogram: string }) {
  return (
    <g>
      <path d={BLOB} fill={`url(#${uid}-wax)`} />
      <path d={BLOB} fill={`url(#${uid}-sheen)`} />
      {/* Pressed well: the flat area the stamp left behind */}
      <circle cx={C} cy={C} r={60} fill={`url(#${uid}-well)`} />
      {/* Embossed rings: light edge below-right, dark edge above-left */}
      <circle cx={C + 1} cy={C + 1} r={60} fill="none" stroke="#c46a83" strokeOpacity=".55" strokeWidth="2" />
      <circle cx={C - 1} cy={C - 1} r={60} fill="none" stroke="#3a0e22" strokeOpacity=".6" strokeWidth="2" />
      <circle cx={C} cy={C} r={51} fill="none" stroke="#3a0e22" strokeOpacity=".45" strokeWidth="1.4" strokeDasharray="1.2 4.2" strokeLinecap="round" />
      {/* Monogram, embossed */}
      <g fontFamily="Bricolage Grotesque, Georgia, serif" fontWeight={800} fontSize={78} textAnchor="middle">
        <text x={C + 2.2} y={C + 28.5} fill="#33091c" fillOpacity=".7">
          {monogram}
        </text>
        <text x={C - 1.4} y={C + 25} fill="#c9758c" fillOpacity=".55">
          {monogram}
        </text>
        <text x={C} y={C + 26.5} fill={`url(#${uid}-mono)`}>
          {monogram}
        </text>
      </g>
      {/* Specular highlight on the poured edge */}
      <ellipse cx={70} cy={52} rx={26} ry={11} transform="rotate(-32 70 52)" fill="#fff" fillOpacity=".16" />
    </g>
  );
}

function Defs({ uid }: { uid: string }) {
  return (
    <defs>
      <radialGradient id={`${uid}-wax`} cx="38%" cy="32%" r="75%">
        <stop offset="0" stopColor="#a8475f" />
        <stop offset=".45" stopColor="#7c2443" />
        <stop offset=".85" stopColor="#5b1731" />
        <stop offset="1" stopColor="#43112a" />
      </radialGradient>
      <radialGradient id={`${uid}-sheen`} cx="50%" cy="50%" r="50%">
        <stop offset=".78" stopColor="#000" stopOpacity="0" />
        <stop offset="1" stopColor="#1c0510" stopOpacity=".35" />
      </radialGradient>
      <radialGradient id={`${uid}-well`} cx="60%" cy="62%" r="65%">
        <stop offset="0" stopColor="#7e2646" />
        <stop offset="1" stopColor="#5e1833" />
      </radialGradient>
      <linearGradient id={`${uid}-mono`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#8a2c4d" />
        <stop offset="1" stopColor="#6a1c39" />
      </linearGradient>
      <clipPath id={`${uid}-l`}>
        <path d={leftClip} />
      </clipPath>
      <clipPath id={`${uid}-r`}>
        <path d={rightClip} />
      </clipPath>
    </defs>
  );
}

export function WaxSeal({
  state,
  size = 140,
  monogram = "S",
  label,
}: {
  state: SealState;
  size?: number;
  monogram?: string;
  label?: string;
}) {
  const uid = useId().replace(/:/g, "");
  // Cracked and lifted seals start closed, then move into place just after mount.
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (state !== "cracked" && state !== "lifted") return setOpen(false);
    setOpen(false);
    const t = setTimeout(() => setOpen(true), 380);
    return () => clearTimeout(t);
  }, [state]);

  return (
    <svg
      key={state}
      width={size}
      height={size}
      viewBox="-12 -12 224 224"
      role="img"
      aria-label={label}
      className={`wax wax-${state}`}
    >
      <Defs uid={uid} />
      {(state === "empty" || state === "lifted") && (
        <circle cx={C} cy={C} r={78} fill="none" stroke="#8a90a6" strokeWidth="2.5" strokeDasharray="7 7" strokeLinecap="round" />
      )}
      {state === "empty" && (
        <text x={C} y={C + 6} textAnchor="middle" fontFamily="Instrument Sans, sans-serif" fontSize="17" fill="#6b7290">
          not sealed yet
        </text>
      )}
      {(state === "pressed" || state === "lifted") && (
        <g
          className={state === "pressed" ? "wax-press" : "wax-half"}
          style={state === "lifted" ? { transform: open ? "translate(46px,-34px) rotate(18deg)" : "none" } : undefined}
        >
          <g>
            <SealArt uid={uid} monogram={monogram} />
            {/* Lifted wax reads as faded: a paper wash instead of group opacity, which some renderers drop */}
            {state === "lifted" && <path d={BLOB} fill="#f3f4f8" fillOpacity=".5" />}
          </g>
        </g>
      )}
      {state === "cracked" && (
        <g className="wax-press">
          <g clipPath={`url(#${uid}-l)`} className="wax-half" style={{ transform: open ? "translate(-9px,4px) rotate(-7deg)" : "none" }}>
            <SealArt uid={uid} monogram={monogram} />
          </g>
          <g clipPath={`url(#${uid}-r)`} className="wax-half" style={{ transform: open ? "translate(9px,-3px) rotate(6deg)" : "none" }}>
            <SealArt uid={uid} monogram={monogram} />
          </g>
          {!open && <path d={crackLine} fill="none" stroke="#2a0715" strokeWidth="2.2" strokeLinejoin="round" className="wax-crack" />}
        </g>
      )}
    </svg>
  );
}

/** Small brand mark: the same seal, simplified for 24–40px. */
export function SealMark({ size = 30 }: { size?: number }) {
  const uid = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="-6 -6 212 212" aria-hidden="true">
      <Defs uid={uid} />
      <path d={BLOB} fill={`url(#${uid}-wax)`} />
      <circle cx={C} cy={C} r={58} fill="none" stroke="#e8a9b9" strokeOpacity=".5" strokeWidth="6" />
      <text x={C} y={C + 33} textAnchor="middle" fontFamily="Bricolage Grotesque, Georgia, serif" fontWeight={800} fontSize={100} fill="#f4dde4">
        S
      </text>
    </svg>
  );
}

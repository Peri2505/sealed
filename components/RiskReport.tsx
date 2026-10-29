"use client";

import type { RedFlag, RiskReport as Risk } from "@/lib/types";

const levelCopy = {
  high: { word: "High risk", color: "text-risk", bar: "bg-risk" },
  medium: { word: "Check carefully", color: "text-[#9a640f]", bar: "bg-hold" },
  low: { word: "Looks okay", color: "text-safe", bar: "bg-safe" },
} as const;

export function RiskMeter({ risk }: { risk: Risk }) {
  const c = levelCopy[risk.level];
  const score = Math.max(0, Math.min(100, Math.round(risk.score)));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <h3 className={`display text-3xl font-extrabold ${c.color}`}>{c.word}</h3>
        <span className="text-sm text-slate">Risk {score} of 100</span>
      </div>
      <div
        className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-line"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score}
        aria-label="Scam risk"
      >
        <div className={`h-full rounded-full ${c.bar} transition-[width] duration-700`} style={{ width: `${Math.max(4, score)}%` }} />
      </div>
      <p className="mt-3 text-[15px] leading-relaxed text-ink">{risk.summary}</p>
    </div>
  );
}

/** Shows the original chat with every red flag marked where it appears. */
export function MarkedChat({ chat, flags }: { chat: string; flags: RedFlag[] }) {
  const lines = chat.split(/\n/).filter((l) => l.trim());
  return (
    <ol className="space-y-1.5 text-[14px] leading-relaxed">
      {lines.map((line, i) => {
        const hits = flags
          .map((f, idx) => ({ f, idx, at: f.quote ? line.toLowerCase().indexOf(f.quote.toLowerCase().slice(0, 60)) : -1 }))
          .filter((h) => h.at >= 0)
          .sort((a, b) => a.at - b.at);
        const m = /^([^:]{1,25}):\s?(.*)$/.exec(line);
        const speaker = m?.[1];
        const offset = m ? line.length - m[2].length : 0;
        return (
          <li key={i} className="flex gap-2">
            {speaker && <span className="w-16 shrink-0 truncate font-semibold text-slate">{speaker}</span>}
            <span className="min-w-0">{renderLine(line.slice(offset), hits.map((h) => ({ ...h, at: h.at - offset })))}</span>
          </li>
        );
      })}
    </ol>
  );
}

function renderLine(text: string, hits: { f: RedFlag; idx: number; at: number }[]) {
  const out: React.ReactNode[] = [];
  let cursor = 0;
  for (const h of hits) {
    const len = Math.min(h.f.quote.length, text.length - Math.max(0, h.at));
    if (h.at < cursor || len <= 0) continue;
    out.push(text.slice(cursor, h.at));
    out.push(
      <mark key={h.idx} className={`flag ${h.f.severity}`} title={h.f.explanation}>
        {text.slice(h.at, h.at + len)}
        <sup className="ml-0.5 text-[10px] font-semibold">{h.idx + 1}</sup>
      </mark>,
    );
    cursor = h.at + len;
  }
  out.push(text.slice(cursor));
  return out;
}

export function FlagList({ flags, safe }: { flags: RedFlag[]; safe: string[] }) {
  return (
    <div className="space-y-4">
      {flags.length > 0 && (
        <ol className="space-y-3">
          {flags.map((f, i) => (
            <li key={i} className="flex gap-3">
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
                  f.severity === "high" ? "bg-risk" : f.severity === "medium" ? "bg-hold" : "bg-slate"
                }`}
              >
                {i + 1}
              </span>
              <div>
                <p className="font-semibold">{f.category}</p>
                <p className="text-sm leading-relaxed text-slate">{f.explanation}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
      {safe.length > 0 && (
        <ul className="space-y-1.5 text-sm text-safe">
          {safe.map((s) => (
            <li key={s} className="flex items-start gap-2">
              <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

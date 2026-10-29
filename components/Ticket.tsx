"use client";

import { useState } from "react";
import { money } from "@/lib/client";
import type { DealStatus, DealTerms } from "@/lib/types";
import { Button, Field, Input, TextArea } from "./ui";

const SEAL: Record<DealStatus, { word: string; sub: string; color: string }> = {
  draft: { word: "Draft", sub: "not agreed", color: "#5d6683" },
  agreed: { word: "Agreed", sub: "awaiting payment", color: "#18203a" },
  funded: { word: "On hold", sub: "money is safe", color: "#d98e1f" },
  disputed: { word: "In review", sub: "money still held", color: "#c13a34" },
  released: { word: "Released", sub: "seller paid", color: "#1f7f58" },
  refunded: { word: "Returned", sub: "buyer not charged", color: "#18203a" },
  split: { word: "Split", sub: "settled fairly", color: "#1f7f58" },
};

/** The circular stamp. Re-mounts (and re-stamps) whenever the status changes. */
export function Seal({ status, size = 132 }: { status: DealStatus; size?: number }) {
  const s = SEAL[status];
  return (
    <div key={status} className="seal seal-animate" aria-label={`Deal status: ${s.word}, ${s.sub}`} role="img">
      <svg width={size} height={size} viewBox="0 0 140 140">
        <defs>
          <path id={`arc-${status}`} d="M70,70 m-50,0 a50,50 0 1,1 100,0 a50,50 0 1,1 -100,0" />
        </defs>
        <circle cx="70" cy="70" r="66" fill="none" stroke={s.color} strokeWidth="3" />
        <circle cx="70" cy="70" r="58" fill="none" stroke={s.color} strokeWidth="1.2" strokeDasharray="2 3" />
        <text fill={s.color} fontSize="10.5" fontWeight="600" letterSpacing="2.4" fontFamily="Instrument Sans, sans-serif">
          <textPath href={`#arc-${status}`} startOffset="2%">
            {`sealed · ${s.sub} · sealed · ${s.sub} ·`}
          </textPath>
        </text>
        <text
          x="70"
          y="77"
          textAnchor="middle"
          fill={s.color}
          fontSize={s.word.length > 7 ? 19 : 23}
          fontWeight="800"
          fontFamily="Bricolage Grotesque, sans-serif"
        >
          {s.word}
        </text>
      </svg>
    </div>
  );
}

const delivery: Record<DealTerms["deliveryMethod"], string> = {
  shipping: "Shipped with tracking",
  in_person: "Hand-off in person",
  digital: "Delivered digitally",
  service: "Service or work",
};

export function Ticket({
  terms,
  status,
  buyerName,
  sellerName,
  footer,
}: {
  terms: DealTerms;
  status?: DealStatus;
  buyerName: string;
  sellerName: string;
  footer?: React.ReactNode;
}) {
  return (
    <article className="ticket overflow-visible">
      <div className="relative p-6 sm:p-7">
        {status && (
          <div className="pointer-events-none absolute -top-6 right-3 sm:right-6">
            <Seal status={status} size={112} />
          </div>
        )}
        <p className="text-sm text-slate">
          {sellerName} sells to {buyerName}
        </p>
        <h2 className={`display mt-1 max-w-[16ch] text-[2rem] font-bold leading-[1.05] sm:text-4xl ${status ? "pr-24 sm:pr-28" : ""}`}>{terms.title}</h2>
        <p className="display mt-4 text-5xl font-extrabold tracking-tight">{money(terms.price, terms.currency)}</p>
        {terms.description && <p className="mt-4 max-w-prose text-[15px] leading-relaxed text-slate">{terms.description}</p>}
        <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-3 text-[15px] sm:grid-cols-3">
          <div>
            <dt className="text-xs text-slate">Condition</dt>
            <dd className="font-medium">{terms.condition}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate">Delivery</dt>
            <dd className="font-medium">{delivery[terms.deliveryMethod]}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate">Deadline</dt>
            <dd className="font-medium">{terms.deadline}</dd>
          </div>
        </dl>
      </div>
      <div className="ticket-perf" />
      <div className="p-6 sm:p-7">
        <h3 className="font-semibold">The seller gets paid when they show</h3>
        <ul className="mt-3 space-y-2">
          {terms.proofRequired.map((p) => (
            <li key={p} className="flex gap-2.5 text-[15px] leading-snug">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full border-2 border-ink" />
              {p}
            </li>
          ))}
        </ul>
        {footer && <div className="mt-5">{footer}</div>}
      </div>
    </article>
  );
}

export function TermsEditor({
  value,
  onChange,
}: {
  value: DealTerms;
  onChange: (t: DealTerms) => void;
}) {
  const set = <K extends keyof DealTerms>(k: K, v: DealTerms[K]) => onChange({ ...value, [k]: v });
  const [newProof, setNewProof] = useState("");
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field label="Deal name">
          <Input value={value.title} onChange={(e) => set("title", e.target.value)} />
        </Field>
      </div>
      <Field label="Item or service">
        <Input value={value.item} onChange={(e) => set("item", e.target.value)} />
      </Field>
      <div className="grid grid-cols-[1fr_5.5rem] gap-2">
        <Field label="Price">
          <Input inputMode="decimal" value={value.price} onChange={(e) => set("price", e.target.value.replace(/[^\d.]/g, ""))} />
        </Field>
        <Field label="Currency">
          <Input value={value.currency} maxLength={3} onChange={(e) => set("currency", e.target.value.toUpperCase())} />
        </Field>
      </div>
      <Field label="Condition">
        <Input value={value.condition} onChange={(e) => set("condition", e.target.value)} />
      </Field>
      <Field label="Delivery">
        <select
          value={value.deliveryMethod}
          onChange={(e) => set("deliveryMethod", e.target.value as DealTerms["deliveryMethod"])}
          className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[15px] focus:border-ink focus:outline-none"
        >
          {Object.entries(delivery).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </Field>
      <div className="sm:col-span-2">
        <Field label="Deadline">
          <Input value={value.deadline} onChange={(e) => set("deadline", e.target.value)} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Description">
          <TextArea rows={2} value={value.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <span className="mb-1.5 block text-sm font-medium">Proof the seller must show</span>
        <ul className="space-y-2">
          {value.proofRequired.map((p, i) => (
            <li key={i} className="flex gap-2">
              <Input
                value={p}
                aria-label={`Proof requirement ${i + 1}`}
                onChange={(e) => set("proofRequired", value.proofRequired.map((x, j) => (j === i ? e.target.value : x)))}
              />
              <Button
                type="button"
                variant="quiet"
                aria-label={`Remove requirement ${i + 1}`}
                onClick={() => set("proofRequired", value.proofRequired.filter((_, j) => j !== i))}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex gap-2">
          <Input placeholder="e.g. Photo of the screen turned on" value={newProof} onChange={(e) => setNewProof(e.target.value)} />
          <Button
            type="button"
            variant="quiet"
            disabled={!newProof.trim()}
            onClick={() => {
              set("proofRequired", [...value.proofRequired, newProof.trim()]);
              setNewProof("");
            }}
          >
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}

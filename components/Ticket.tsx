"use client";

import { useState } from "react";
import { money } from "@/lib/client";
import type { DealStatus, DealTerms } from "@/lib/types";
import { Button, Field, Input, TextArea } from "./ui";
import { WaxSeal, type SealState } from "./WaxSeal";

const SEAL: Record<DealStatus, { state: SealState; word: string; sub: string; color: string }> = {
  draft: { state: "empty", word: "Not sealed yet", sub: "Both people need to agree to the terms.", color: "text-slate" },
  agreed: { state: "empty", word: "Ready to seal", sub: "The seal goes on when the buyer pays.", color: "text-ink" },
  funded: { state: "pressed", word: "Sealed", sub: "The money is on hold. Nobody can touch it.", color: "text-wax" },
  disputed: { state: "pressed", word: "Sealed, under review", sub: "The money stays on hold while the mediator looks.", color: "text-risk" },
  released: { state: "cracked", word: "Seal broken, seller paid", sub: "The money was released to the seller.", color: "text-safe" },
  refunded: { state: "lifted", word: "Seal lifted, buyer refunded", sub: "The buyer was never charged.", color: "text-ink" },
  split: { state: "cracked", word: "Seal broken, split fairly", sub: "Part to the seller, the rest back to the buyer.", color: "text-safe" },
};

export function Seal({ status, size = 132 }: { status: DealStatus; size?: number }) {
  const s = SEAL[status];
  return <WaxSeal state={s.state} size={size} label={`${s.word}. ${s.sub}`} />;
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
  const seal = status ? SEAL[status] : null;
  return (
    <article className="letter">
      <div className="p-6 pb-8 sm:p-8 sm:pb-9">
        <p className="text-sm text-slate">
          A deal between {sellerName} and {buyerName}
        </p>
        <h2 className="display mt-1.5 max-w-[18ch] text-[2rem] font-bold leading-[1.05] sm:text-4xl">{terms.title}</h2>
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
        {seal && (
          <p className="mt-6 pr-28 sm:pr-40" aria-live="polite">
            <span className={`display block text-xl font-bold ${seal.color}`}>{seal.word}</span>
            <span className="text-sm text-slate">{seal.sub}</span>
          </p>
        )}
      </div>
      <div className="letter-fold relative">
        {status && (
          <div className="pointer-events-none absolute right-2 top-1/2 z-10 -translate-y-1/2 sm:right-6">
            <div className="sm:hidden">
              <Seal status={status} size={112} />
            </div>
            <div className="hidden sm:block">
              <Seal status={status} size={150} />
            </div>
          </div>
        )}
      </div>
      <div className={`p-6 pt-7 sm:p-8 sm:pt-8 ${status ? "pr-28 sm:pr-44" : ""}`}>
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

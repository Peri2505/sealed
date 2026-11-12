"use client";

import { useState } from "react";
import { api, fileToDataUrl, money } from "@/lib/client";
import type { DealEvent, PublicDeal, Role, Verification } from "@/lib/types";
import { PayButton } from "./PayButton";
import { Button, ErrorNote, Field, Input, TextArea } from "./ui";

type Props = {
  deal: PublicDeal;
  role: Role;
  token: string;
  clientId: string | null;
  otherLink: string | null;
  onChange: (d: PublicDeal) => void;
};

export function DealActions(props: Props) {
  const { deal, role } = props;
  const other = role === "buyer" ? deal.sellerName : deal.buyerName;
  const s = deal.status;

  if (s === "draft") return <AgreeStep {...props} other={other} />;
  if (s === "agreed")
    return role === "buyer" ? (
      <Panel title="Put the money on hold">
        <p className="mb-4 text-[15px] leading-relaxed text-slate">
          PayPal will authorize {money(deal.terms.price, deal.terms.currency)} on your account. It's reserved, not sent. {deal.sellerName}{" "}
          only gets it after their proof checks out.
        </p>
        <PayButton deal={deal} token={props.token} clientId={props.clientId} onFunded={props.onChange} />
      </Panel>
    ) : (
      <Panel title={`Waiting for ${deal.buyerName} to pay`}>
        <p className="text-[15px] leading-relaxed text-slate">
          Don't ship anything yet. You'll see the money go on hold here first, and then it's safe to send.
        </p>
      </Panel>
    );
  if (s === "funded")
    return role === "seller" ? <ProofStep {...props} /> : <BuyerHoldStep {...props} />;
  if (s === "disputed") return <DisputeStep {...props} />;
  return <Outcome deal={deal} role={role} />;
}

function Panel({ title, children, tone }: { title: string; children: React.ReactNode; tone?: "hold" | "risk" | "safe" }) {
  const border = tone === "hold" ? "border-wax/40" : tone === "risk" ? "border-risk/40" : tone === "safe" ? "border-safe/40" : "border-line";
  return (
    <section className={`rounded-2xl border bg-card p-5 sm:p-6 ${border}`}>
      <h2 className="display text-2xl font-bold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function useAction(onChange: (d: PublicDeal) => void) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const run = async (key: string, fn: () => Promise<{ deal: PublicDeal }>) => {
    setError("");
    setBusy(key);
    try {
      onChange((await fn()).deal);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  return { busy, error, run };
}

function AgreeStep({ deal, role, token, otherLink, onChange, other }: Props & { other: string }) {
  const { busy, error, run } = useAction(onChange);
  const [copied, setCopied] = useState(false);
  if (deal.approvals[role]) {
    return (
      <Panel title={`Send this to ${other}`}>
        <p className="text-[15px] leading-relaxed text-slate">
          You've agreed. The deal starts once {other} opens their link and agrees too. Their link is private to them.
        </p>
        {otherLink ? (
          <div className="mt-4 flex gap-2">
            <Input readOnly value={otherLink} aria-label={`${other}'s link`} onFocus={(e) => e.target.select()} />
            <Button
              variant="quiet"
              onClick={async () => {
                await navigator.clipboard.writeText(otherLink).catch(() => {});
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              }}
            >
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate">Ask whoever created the deal to send {other} their link.</p>
        )}
      </Panel>
    );
  }
  return (
    <Panel title="Do these terms match what you agreed?">
      <p className="text-[15px] leading-relaxed text-slate">
        {other} already agreed. Once you do, the terms are locked and nobody can change them.
      </p>
      <div className="mt-4 space-y-3">
        <ErrorNote>{error}</ErrorNote>
        <Button
          className="w-full"
          busy={busy === "agree"}
          onClick={() => run("agree", () => api(`/api/deals/${deal.id}/agree`, { method: "POST", token }))}
        >
          Agree to these terms
        </Button>
      </div>
    </Panel>
  );
}

function BuyerHoldStep({ deal, token, onChange }: Props) {
  const { busy, error, run } = useAction(onChange);
  const [problem, setProblem] = useState("");
  const [showProblem, setShowProblem] = useState(false);
  const v = deal.proof?.verification;
  return (
    <Panel title="Your money is on hold" tone="hold">
      <p className="text-[15px] leading-relaxed text-slate">
        {deal.proof
          ? `${deal.sellerName} sent proof, but it needs a closer look before the money moves.`
          : `${deal.sellerName} can't receive it until they upload proof that matches the terms. If you already have the item and it's right, you can release it yourself.`}
      </p>
      {v && <VerificationCard v={v} images={proofImages(deal)} />}
      <div className="mt-5 space-y-3">
        <ErrorNote>{error}</ErrorNote>
        <Button
          variant="safe"
          className="w-full"
          busy={busy === "confirm"}
          onClick={() => run("confirm", () => api(`/api/deals/${deal.id}/confirm`, { method: "POST", token }))}
        >
          I received it. Release {money(deal.terms.price, deal.terms.currency)}
        </Button>
        {showProblem ? (
          <div className="space-y-2">
            <TextArea rows={3} placeholder="What's wrong?" value={problem} onChange={(e) => setProblem(e.target.value)} />
            <Button
              variant="danger"
              className="w-full"
              busy={busy === "dispute"}
              onClick={() => run("dispute", () => api(`/api/deals/${deal.id}/dispute`, { body: { statement: problem }, token }))}
            >
              Report the problem
            </Button>
          </div>
        ) : (
          <Button variant="quiet" className="w-full" onClick={() => setShowProblem(true)}>
            Something's wrong
          </Button>
        )}
      </div>
    </Panel>
  );
}

const PHOTO_SLOTS = [
  { label: "Photo 1: the item", hint: "Show it clearly, in good light." },
  { label: "Photo 2: in its box or case", hint: "Optional, but it helps the check." },
];

function PhotoSlot({ label, hint, value, onPick }: { label: string; hint: string; value: string | null; onPick: (v: string | null) => void }) {
  const [err, setErr] = useState("");
  return (
    <div className="min-w-0">
      <span className="block text-sm font-medium">{label}</span>
      <span className="mb-1.5 block text-xs text-slate">{hint}</span>
      <label className="flex h-40 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-line bg-paper text-sm text-slate hover:border-slate/60">
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={async (e) => {
            setErr("");
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              onPick(await fileToDataUrl(f));
            } catch (error) {
              setErr((error as Error).message);
            }
          }}
        />
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt={label} className="h-full w-full object-contain" />
        ) : (
          <span>Take or choose a photo</span>
        )}
      </label>
      {value && (
        <button type="button" onClick={() => onPick(null)} className="mt-1 text-xs text-slate underline underline-offset-2 hover:text-ink">
          Remove
        </button>
      )}
      {err && <p className="mt-1 text-sm text-risk">{err}</p>}
    </div>
  );
}

function ProofStep({ deal, token, onChange }: Props) {
  const { busy, error, run } = useAction(onChange);
  const [photos, setPhotos] = useState<(string | null)[]>([null, null]);
  const [note, setNote] = useState("");
  const [tracking, setTracking] = useState("");
  const v = deal.proof?.verification;
  const chosen = photos.filter((p): p is string => Boolean(p));
  return (
    <Panel title="Show your proof, get paid" tone="hold">
      <p className="text-[15px] leading-relaxed text-slate">
        {money(deal.terms.price, deal.terms.currency)} is on hold for you. Upload proof that covers each point on the deal. If it
        checks out, the money is released right away.
      </p>
      {v && (
        <div className="mt-4">
          <p className="text-sm font-semibold">Last check</p>
          <VerificationCard v={v} images={proofImages(deal)} />
        </div>
      )}
      <div className="mt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {PHOTO_SLOTS.map((slot, i) => (
            <PhotoSlot
              key={slot.label}
              {...slot}
              value={photos[i]}
              onPick={(val) => setPhotos((cur) => cur.map((p, j) => (j === i ? val : p)))}
            />
          ))}
        </div>
        {deal.terms.deliveryMethod === "shipping" && (
          <Field label="Tracking number" hint="From any carrier: USPS, UPS, FedEx, DHL…">
            <Input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Paste the tracking number from your shipping receipt" />
          </Field>
        )}
        <Field label="Note for the buyer" hint="Optional. Mention anything the photos don't show.">
          <TextArea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <ErrorNote>{error}</ErrorNote>
        <Button
          className="w-full"
          busy={busy === "proof"}
          disabled={!chosen.length && !tracking && !note}
          onClick={() => run("proof", () => api(`/api/deals/${deal.id}/proof`, { body: { imageDataUrls: chosen, note, tracking }, token }))}
        >
          {busy === "proof" ? "Checking your proof" : "Submit proof"}
        </Button>
      </div>
    </Panel>
  );
}

/** Every proof photo, including deals from before multi-photo proof. */
function proofImages(deal: PublicDeal): string[] {
  const p = deal.proof;
  if (!p) return [];
  return p.images?.length ? p.images : p.imageDataUrl ? [p.imageDataUrl] : [];
}

function DisputeStep({ deal, role, token, onChange }: Props) {
  const { busy, error, run } = useAction(onChange);
  const [statement, setStatement] = useState("");
  const d = deal.dispute!;
  const mine = d.statements[role];
  const theirs = d.statements[role === "buyer" ? "seller" : "buyer"];
  const v = deal.proof?.verification;
  return (
    <Panel title="The money stays on hold" tone="risk">
      <p className="text-[15px] leading-relaxed text-slate">
        {d.reason} Each of you can explain what happened. Then the mediator compares it with the terms and the proof, and settles the
        payment.
      </p>
      {v && <VerificationCard v={v} images={proofImages(deal)} />}
      <div className="mt-5 space-y-4">
        {mine ? (
          <Quote who="You said" text={mine} />
        ) : (
          <div className="space-y-2">
            <Field label="Your side">
              <TextArea rows={3} value={statement} onChange={(e) => setStatement(e.target.value)} />
            </Field>
            <Button
              variant="quiet"
              className="w-full"
              busy={busy === "statement"}
              disabled={statement.trim().length < 5}
              onClick={() => run("statement", () => api(`/api/deals/${deal.id}/dispute`, { body: { statement }, token }))}
            >
              Add my side
            </Button>
          </div>
        )}
        {theirs && <Quote who={`${role === "buyer" ? deal.sellerName : deal.buyerName} said`} text={theirs} />}
        <ErrorNote>{error}</ErrorNote>
        <Button
          className="w-full"
          busy={busy === "mediate"}
          disabled={!mine && !theirs}
          onClick={() => run("mediate", () => api(`/api/deals/${deal.id}/mediate`, { method: "POST", token }))}
        >
          {busy === "mediate" ? "The mediator is reviewing" : "Ask the mediator to decide"}
        </Button>
      </div>
    </Panel>
  );
}

function Quote({ who, text }: { who: string; text: string }) {
  return (
    <figure className="border-l-2 border-line pl-4">
      <figcaption className="text-xs text-slate">{who}</figcaption>
      <blockquote className="mt-1 text-[15px] leading-relaxed">{text}</blockquote>
    </figure>
  );
}

export function VerificationCard({ v, images }: { v: Verification; images: string[] }) {
  const icon = { yes: "✓", no: "✕", unclear: "?" } as const;
  const color = { yes: "text-safe", no: "text-risk", unclear: "text-[#9a640f]" } as const;
  return (
    <div className="mt-4 rounded-xl border border-line bg-paper p-4">
      <div className="flex flex-wrap gap-4">
        {images.length > 0 && (
          <div className="flex shrink-0 gap-2">
            {images.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={src} alt={`Seller's proof photo ${i + 1}`} className="h-20 w-20 rounded-lg object-cover" />
            ))}
          </div>
        )}
        <div className="min-w-0 flex-1 basis-56">
          <p className="font-semibold">
            {v.verdict === "pass" ? "Proof matches the terms" : v.verdict === "fail" ? "Proof doesn't match the terms" : "Not enough proof yet"}
            <span className="ml-2 text-sm font-normal text-slate">{Math.round(v.confidence * 100)}% confident</span>
          </p>
          <p className="mt-1 text-sm leading-relaxed text-slate">{v.summary}</p>
          {v.manipulationDetected && (
            <p className="mt-2 text-sm font-medium text-risk">The proof tried to give instructions to the AI checker. It was ignored.</p>
          )}
        </div>
      </div>
      <ul className="mt-3 space-y-1.5 text-sm">
        {v.checks.map((c, i) => (
          <li key={i} className="flex gap-2">
            <span className={`w-4 shrink-0 text-center font-bold ${color[c.met]}`} aria-label={c.met}>
              {icon[c.met]}
            </span>
            <span>
              <span className="font-medium">{c.requirement}.</span> <span className="text-slate">{c.evidence}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Outcome({ deal, role }: { deal: PublicDeal; role: Role }) {
  const r = deal.dispute?.ruling;
  const cur = deal.terms.currency;
  const captured = deal.paypal.capturedAmount ?? "0.00";
  const returned = (Number(deal.terms.price) - Number(captured)).toFixed(2);
  const title =
    deal.status === "released"
      ? role === "seller"
        ? `You've been paid ${money(captured, cur)}`
        : `${deal.sellerName} has been paid`
      : deal.status === "refunded"
        ? role === "buyer"
          ? "You weren't charged"
          : "The hold was cancelled"
        : `Settled: ${money(captured, cur)} to ${deal.sellerName}, ${money(returned, cur)} back to ${deal.buyerName}`;
  return (
    <Panel title={title} tone={deal.status === "refunded" ? undefined : "safe"}>
      {r ? (
        <>
          <p className="text-[15px] leading-relaxed">{r.reasoning}</p>
          {r.keyFindings.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate">
              {r.keyFindings.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="text-[15px] leading-relaxed text-slate">
          {deal.status !== "released"
            ? "The money never left the buyer's account."
            : deal.proof?.verification?.verdict === "pass"
              ? "The proof covered every term, so the hold was turned into a payment. Nobody had to trust anybody."
              : `${deal.buyerName} confirmed they received it, so the hold was turned into a payment.`}
        </p>
      )}
      {deal.proof?.verification && <VerificationCard v={deal.proof.verification} images={proofImages(deal)} />}
    </Panel>
  );
}

const actorLabel: Record<DealEvent["actor"], string> = {
  buyer: "Buyer",
  seller: "Seller",
  ai: "Sealed AI",
  paypal: "PayPal",
  system: "Sealed",
};

export function Timeline({ events }: { events: DealEvent[] }) {
  return (
    <ol className="relative space-y-5 border-l border-line pl-6">
      {[...events].reverse().map((e, i) => (
        <li key={i} className="relative">
          <span
            className={`absolute -left-[30.5px] top-1.5 h-3 w-3 rounded-full border-2 border-paper ${
              e.actor === "paypal" ? "bg-wax" : e.actor === "ai" ? "bg-ink" : "bg-slate/60"
            }`}
          />
          <p className="text-xs text-slate">
            {actorLabel[e.actor]}, {new Date(e.at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          </p>
          <p className="mt-0.5 text-[15px] leading-relaxed">{e.message}</p>
        </li>
      ))}
    </ol>
  );
}

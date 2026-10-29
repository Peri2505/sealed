"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, fileToDataUrl, rememberLinks } from "@/lib/client";
import { SAMPLES } from "@/lib/samples";
import type { DealTerms, PublicDeal, RiskReport, Role } from "@/lib/types";
import { FlagList, MarkedChat, RiskMeter } from "@/components/RiskReport";
import { Ticket, TermsEditor } from "@/components/Ticket";
import { Button, DemoBadge, ErrorNote, Field, Input, TextArea } from "@/components/ui";

type Analysis = { risk: RiskReport; terms: DealTerms; buyerName: string | null; sellerName: string | null };
type Config = { aiSimulated: boolean; paypalSimulated: boolean; payoutsEnabled: boolean };

export default function Home() {
  const router = useRouter();
  const [config, setConfig] = useState<Config | null>(null);
  const [chat, setChat] = useState("");
  const [shot, setShot] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [scannedChat, setScannedChat] = useState("");
  const [terms, setTerms] = useState<DealTerms | null>(null);
  const [editing, setEditing] = useState(false);
  const [names, setNames] = useState({ buyer: "", seller: "" });
  const [role, setRole] = useState<Role>("buyer");
  const [sellerEmail, setSellerEmail] = useState("");
  const [busy, setBusy] = useState<"scan" | "create" | null>(null);
  const [error, setError] = useState("");
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<Config>("/api/config").then(setConfig).catch(() => {});
  }, []);

  async function scan() {
    setError("");
    setBusy("scan");
    try {
      const a = await api<Analysis>("/api/analyze", { body: { chat, screenshot: shot } });
      setAnalysis(a);
      setScannedChat(chat);
      setTerms(a.terms);
      setNames({ buyer: a.buyerName ?? "", seller: a.sellerName ?? "" });
      setEditing(false);
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function create() {
    if (!terms || !analysis) return;
    setError("");
    setBusy("create");
    try {
      const res = await api<{ deal: PublicDeal; links: { buyer: string; seller: string } }>("/api/deals", {
        body: {
          terms,
          risk: analysis.risk,
          buyerName: names.buyer || "Buyer",
          sellerName: names.seller || "Seller",
          sellerPaypalEmail: sellerEmail || undefined,
          creatorRole: role,
        },
      });
      rememberLinks(res.deal.id, res.links);
      const mine = new URL(res.links[role]);
      router.push(`${mine.pathname}${mine.search}&created=1`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  return (
    <div>
      <section className="grid gap-10 pt-6 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:pt-12">
        <div>
          <h1 className="display text-[2.6rem] font-extrabold leading-[0.98] sm:text-6xl">
            Paying a stranger? Get it sealed first.
          </h1>
          <p className="mt-5 max-w-[46ch] text-lg leading-relaxed text-slate">
            Paste your chat with a buyer or seller. Sealed points out scam warning signs, writes down what you agreed,
            and keeps the money on hold with PayPal until the seller proves they delivered.
          </p>
          {config && (config.aiSimulated || config.paypalSimulated) && (
            <div className="mt-5 flex flex-wrap gap-2">
              {config.aiSimulated && <DemoBadge what="AI in offline demo mode" />}
              {config.paypalSimulated && <DemoBadge what="PayPal payments simulated" />}
            </div>
          )}
        </div>

        <div className="rounded-[22px] border border-line bg-card p-5 shadow-[0_1px_0_#d9deea,0_18px_40px_-24px_rgba(24,32,58,.35)] sm:p-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="chat" className="font-semibold">
              Your conversation
            </label>
            <div className="flex gap-1.5 text-sm">
              {(Object.keys(SAMPLES) as (keyof typeof SAMPLES)[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setChat(SAMPLES[k].chat)}
                  className="rounded-lg px-2.5 py-1 text-slate underline-offset-4 hover:bg-paper hover:text-ink hover:underline"
                >
                  Try {SAMPLES[k].label.toLowerCase()}
                </button>
              ))}
            </div>
          </div>
          <TextArea
            id="chat"
            rows={9}
            placeholder={"Seller: Yes it's still available, $400\nYou: Great, can you ship it?"}
            value={chat}
            onChange={(e) => setChat(e.target.value)}
            className="font-[450]"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <label className="cursor-pointer text-sm text-slate hover:text-ink">
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) setShot(await fileToDataUrl(f, 1600).catch(() => null));
                }}
              />
              {shot ? "Screenshot added. Change it" : "Or add a screenshot of the chat"}
            </label>
            <Button onClick={scan} busy={busy === "scan"} disabled={!chat.trim() && !shot}>
              {busy === "scan" ? "Reading the chat" : "Check this deal"}
            </Button>
          </div>
          {error && !analysis && (
            <div className="mt-3">
              <ErrorNote>{error}</ErrorNote>
            </div>
          )}
        </div>
      </section>

      {analysis && terms && (
        <section ref={resultRef} className="mt-16 scroll-mt-6 grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:gap-12">
          <div className="space-y-6">
            <RiskMeter risk={analysis.risk} />
            {scannedChat && (
              <div className="rounded-2xl border border-line bg-card p-5">
                <MarkedChat chat={scannedChat} flags={analysis.risk.flags} />
              </div>
            )}
            <FlagList flags={analysis.risk.flags} safe={analysis.risk.safeSignals} />
          </div>

          <div className="space-y-6">
            <div>
              <h2 className="display text-2xl font-bold">
                {analysis.risk.level === "high" ? "Still want to go ahead? Make it safe." : "Here's the deal, in writing"}
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed text-slate">
                {analysis.risk.level === "high"
                  ? "A real seller won't mind this. A scammer will refuse, and that tells you everything."
                  : "Check the terms. The buyer's money is only released when the seller shows this proof."}
              </p>
            </div>

            {editing ? (
              <div className="rounded-2xl border border-line bg-card p-5">
                <TermsEditor value={terms} onChange={setTerms} />
                <div className="mt-4 flex justify-end">
                  <Button variant="quiet" onClick={() => setEditing(false)}>
                    Done editing
                  </Button>
                </div>
              </div>
            ) : (
              <Ticket
                terms={terms}
                buyerName={names.buyer || "Buyer"}
                sellerName={names.seller || "Seller"}
                footer={
                  <Button variant="quiet" onClick={() => setEditing(true)}>
                    Edit terms
                  </Button>
                }
              />
            )}

            <div className="rounded-2xl border border-line bg-card p-5">
              <fieldset>
                <legend className="mb-2 font-semibold">In this deal, I'm the</legend>
                <div className="inline-flex rounded-xl border border-line p-1">
                  {(["buyer", "seller"] as Role[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      aria-pressed={role === r}
                      onClick={() => setRole(r)}
                      className={`rounded-lg px-4 py-1.5 text-sm font-semibold capitalize ${role === r ? "bg-ink text-white" : "text-slate hover:text-ink"}`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </fieldset>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Buyer's name">
                  <Input value={names.buyer} onChange={(e) => setNames({ ...names, buyer: e.target.value })} />
                </Field>
                <Field label="Seller's name">
                  <Input value={names.seller} onChange={(e) => setNames({ ...names, seller: e.target.value })} />
                </Field>
                {config?.payoutsEnabled && (
                  <div className="sm:col-span-2">
                    <Field label="Seller's PayPal email" hint="Where the seller's money is sent once it's released.">
                      <Input type="email" value={sellerEmail} onChange={(e) => setSellerEmail(e.target.value)} />
                    </Field>
                  </div>
                )}
              </div>
              <div className="mt-5 space-y-3">
                <ErrorNote>{error}</ErrorNote>
                <Button className="w-full" onClick={create} busy={busy === "create"}>
                  Agree and get a link for the {role === "buyer" ? "seller" : "buyer"}
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      <HowItWorks />
    </div>
  );
}

function HowItWorks() {
  const steps = [
    ["Check the chat", "AI reads the conversation and marks the warning signs scammers rely on: gift cards, rush, moving to another app."],
    ["Agree in writing", "Both people approve the same terms, including exactly what proof the seller must show."],
    ["Money goes on hold", "The buyer pays with PayPal. The payment is authorized, not taken, so nobody can run off with it."],
    ["Proof gets checked", "The seller uploads a photo or tracking number. AI checks it against every term before anything is released."],
    ["Fair ending", "Proof passes: the seller is paid. It doesn't: the hold is cancelled, or a mediator splits it fairly."],
  ];
  return (
    <section id="how" className="mt-24 scroll-mt-6">
      <h2 className="display text-3xl font-bold sm:text-4xl">How Sealed works</h2>
      <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
        {steps.map(([title, body], i) => (
          <li key={title} className="border-t-2 border-ink pt-4">
            <span className="display text-sm font-bold text-slate">Step {i + 1}</span>
            <h3 className="mt-1 font-semibold">{title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate">{body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

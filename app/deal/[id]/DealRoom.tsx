"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { api, recallLinks } from "@/lib/client";
import type { PublicDeal } from "@/lib/types";
import { DealActions, Timeline } from "@/components/DealActions";
import { Ticket } from "@/components/Ticket";
import { DemoBadge, ErrorNote } from "@/components/ui";

type Config = { paypalClientId: string | null; paypalSimulated: boolean; aiSimulated: boolean };
const SETTLED = ["released", "refunded", "split"];

export function DealRoom() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const token = params.get("t") ?? "";
  const [deal, setDeal] = useState<PublicDeal | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [error, setError] = useState("");
  const [links, setLinks] = useState<{ buyer: string; seller: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const { deal } = await api<{ deal: PublicDeal }>(`/api/deals/${id}`, { token });
      setDeal(deal);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id, token]);

  useEffect(() => {
    load();
    api<Config>("/api/config").then(setConfig).catch(() => {});
    setLinks(recallLinks(id));
  }, [id, load]);

  // Keep both people's screens in sync while the deal is live.
  useEffect(() => {
    if (!deal || SETTLED.includes(deal.status)) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 4000);
    return () => clearInterval(t);
  }, [deal, load]);

  if (error && !deal)
    return (
      <div className="mx-auto max-w-lg pt-16">
        <ErrorNote>{error}</ErrorNote>
        <Link href="/" className="mt-4 inline-block text-sm underline underline-offset-4">
          Start a new deal
        </Link>
      </div>
    );
  if (!deal || !deal.viewerRole) return <p className="pt-16 text-slate">Opening the deal…</p>;

  const role = deal.viewerRole;
  const otherRole = role === "buyer" ? "seller" : "buyer";
  const otherLink = links?.[otherRole] ?? null;

  return (
    <div className="pt-4">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[15px]">
          You're the <span className="font-semibold">{role}</span> in this deal
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {config?.paypalSimulated && <DemoBadge what="PayPal payments simulated" />}
          {config?.aiSimulated && <DemoBadge what="AI in offline demo mode" />}
          {otherLink && (
            <a href={otherLink} className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-medium hover:border-slate/60">
              Switch to the {otherRole}'s view
            </a>
          )}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:gap-12">
        <div className="space-y-8 pt-4">
          <Ticket terms={deal.terms} status={deal.status} buyerName={deal.buyerName} sellerName={deal.sellerName} />
          {deal.risk && deal.risk.flags.length > 0 && (
            <section className="rounded-2xl border border-line bg-card p-5">
              <h3 className="font-semibold">Warning signs found in the original chat</h3>
              <ul className="mt-2 space-y-1 text-sm text-slate">
                {deal.risk.flags.map((f, i) => (
                  <li key={i}>
                    <span className="font-medium text-ink">{f.category}:</span> “{f.quote}”
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <div className="space-y-10">
          <DealActions deal={deal} role={role} token={token} clientId={config?.paypalClientId ?? null} otherLink={otherLink} onChange={setDeal} />
          <section>
            <h2 className="mb-4 font-semibold">What's happened so far</h2>
            <Timeline events={deal.events} />
          </section>
          {deal.paypal.authorizationId && (
            <section className="text-xs leading-relaxed text-slate">
              <p>PayPal order {deal.paypal.orderId}</p>
              <p>Authorization {deal.paypal.authorizationId}</p>
              {deal.paypal.authorizationExpiresAt && (
                <p>Hold valid until {new Date(deal.paypal.authorizationExpiresAt).toLocaleDateString()}</p>
              )}
              {deal.paypal.captureId && <p>Capture {deal.paypal.captureId}</p>}
              {deal.paypal.payoutBatchId && <p>Payout batch {deal.paypal.payoutBatchId}</p>}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

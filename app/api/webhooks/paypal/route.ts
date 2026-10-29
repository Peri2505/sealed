import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/paypal";
import { addEvent, findDealByOrderOrAuth, saveDeal, withDealLock } from "@/lib/store";

/**
 * PayPal webhooks keep the deal timeline in sync with what PayPal actually did
 * (for example a hold voided from the PayPal dashboard or an authorization expiring).
 * Unverified events are rejected.
 */
const MESSAGES: Record<string, string> = {
  "PAYMENT.AUTHORIZATION.CREATED": "PayPal confirmed the hold.",
  "PAYMENT.AUTHORIZATION.VOIDED": "PayPal confirmed the hold was cancelled.",
  "PAYMENT.CAPTURE.COMPLETED": "PayPal confirmed the payment was captured.",
  "PAYMENT.CAPTURE.REFUNDED": "PayPal confirmed a refund.",
  "PAYMENT.CAPTURE.DENIED": "PayPal denied the capture.",
  "PAYMENT.PAYOUTSBATCH.SUCCESS": "PayPal confirmed the seller's payout.",
};

export async function POST(req: Request) {
  const raw = await req.text();
  let ok = false;
  try {
    ok = await verifyWebhookSignature(req.headers, raw);
  } catch (e) {
    console.error("[webhook] verification error", e);
  }
  if (!ok) return NextResponse.json({ error: "Signature could not be verified." }, { status: 401 });

  const evt = JSON.parse(raw) as {
    id: string;
    event_type: string;
    resource?: { id?: string; custom_id?: string; invoice_id?: string; supplementary_data?: { related_ids?: { authorization_id?: string } } };
  };
  const msg = MESSAGES[evt.event_type];
  if (!msg) return NextResponse.json({ ignored: evt.event_type });

  const r = evt.resource ?? {};
  const dealId = r.custom_id || r.invoice_id?.replace(/^sealed-/, "") || null;
  const authorizationId = r.supplementary_data?.related_ids?.authorization_id || (evt.event_type.startsWith("PAYMENT.AUTHORIZATION") ? r.id : null);
  const found = await findDealByOrderOrAuth({ dealId, authorizationId });
  if (!found) return NextResponse.json({ ignored: "no matching deal" });

  await withDealLock(found.id, async () => {
    const deal = (await findDealByOrderOrAuth({ dealId: found.id }))!;
    if (deal.events.some((e) => e.type === `webhook:${evt.id}`)) return; // idempotent
    addEvent(deal, "paypal", `webhook:${evt.id}`, msg);
    if (evt.event_type === "PAYMENT.AUTHORIZATION.VOIDED" && deal.status === "funded") deal.status = "refunded";
    await saveDeal(deal);
  });
  return NextResponse.json({ received: true });
}

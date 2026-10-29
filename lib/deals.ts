import "server-only";
import { addEvent, getDeal, newId, roleForToken, saveDeal, withDealLock } from "./store";
import * as paypal from "./paypal";
import * as ai from "./ai";
import type { Deal, DealTerms, RiskReport, Role } from "./types";

export class DealError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const AUTO_RELEASE_CONFIDENCE = Number(process.env.AUTO_RELEASE_CONFIDENCE ?? 0.8);
const fmt = (d: Deal, amount = d.terms.price) => `$${amount} ${d.terms.currency}`;

export async function loadForViewer(id: string, token: string | null) {
  const deal = await getDeal(id);
  if (!deal) throw new DealError("This deal doesn't exist or the link is incomplete.", 404);
  const role = roleForToken(deal, token);
  if (!role) throw new DealError("This link isn't valid for this deal. Ask the other person to resend it.", 403);
  return { deal, role };
}

function need(cond: unknown, msg: string, status = 409): asserts cond {
  if (!cond) throw new DealError(msg, status);
}

export function validateTerms(t: Partial<DealTerms>): DealTerms {
  const price = Number(t.price);
  need(Number.isFinite(price) && price >= 1 && price <= 10000, "Enter a price between $1 and $10,000.", 400);
  need(typeof t.item === "string" && t.item.trim().length > 0, "Describe the item or service.", 400);
  const proof = (t.proofRequired ?? []).map((p) => String(p).trim()).filter(Boolean).slice(0, 6);
  need(proof.length > 0, "Add at least one thing the seller must show to get paid.", 400);
  const currency = String(t.currency || "USD").toUpperCase();
  need(/^[A-Z]{3}$/.test(currency), "Use a three-letter currency code like USD.", 400);
  return {
    title: String(t.title || t.item).slice(0, 80),
    item: String(t.item).slice(0, 120),
    description: String(t.description || "").slice(0, 600),
    price: price.toFixed(2),
    currency,
    condition: String(t.condition || "As described").slice(0, 120),
    deliveryMethod: (["shipping", "in_person", "digital", "service"] as const).includes(t.deliveryMethod as never)
      ? (t.deliveryMethod as DealTerms["deliveryMethod"])
      : "shipping",
    deadline: String(t.deadline || "Within 5 days of payment").slice(0, 120),
    proofRequired: proof.map((p) => p.slice(0, 200)),
  };
}

export async function createDeal(input: {
  terms: Partial<DealTerms>;
  risk: RiskReport | null;
  buyerName?: string;
  sellerName?: string;
  sellerPaypalEmail?: string;
  creatorRole: Role;
}) {
  const terms = validateTerms(input.terms);
  const email = input.sellerPaypalEmail?.trim() || null;
  need(!email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), "That PayPal email doesn't look right.", 400);
  const now = new Date().toISOString();
  const deal: Deal = {
    id: newId(6),
    createdAt: now,
    updatedAt: now,
    status: "draft",
    terms,
    risk: input.risk,
    buyerName: (input.buyerName || "Buyer").slice(0, 40),
    sellerName: (input.sellerName || "Seller").slice(0, 40),
    sellerPaypalEmail: email,
    approvals: { buyer: false, seller: false },
    tokens: { buyer: newId(18), seller: newId(18) },
    paypal: {
      orderId: null,
      authorizationId: null,
      authorizationExpiresAt: null,
      captureId: null,
      capturedAmount: null,
      payoutBatchId: null,
      simulated: !paypal.paypalConfigured,
    },
    proof: null,
    dispute: null,
    events: [],
  };
  deal.approvals[input.creatorRole] = true;
  addEvent(deal, "system", "created", `Deal created for ${fmt(deal)}.`);
  addEvent(deal, input.creatorRole, "agreed", `${nameOf(deal, input.creatorRole)} agreed to the terms.`);
  if (input.risk) addEvent(deal, "ai", "risk_scanned", `Chat scanned: ${input.risk.level} risk (${input.risk.score}/100).`);
  return saveDeal(deal);
}

export const nameOf = (d: Deal, r: Role) => (r === "buyer" ? d.buyerName : d.sellerName);

export async function agree(id: string, role: Role) {
  return withDealLock(id, async () => {
    const deal = (await getDeal(id))!;
    need(deal.status === "draft", "Terms are already locked.");
    if (!deal.approvals[role]) {
      deal.approvals[role] = true;
      addEvent(deal, role, "agreed", `${nameOf(deal, role)} agreed to the terms.`);
    }
    if (deal.approvals.buyer && deal.approvals.seller) {
      deal.status = "agreed";
      addEvent(deal, "system", "terms_locked", "Both sides agreed. Terms are locked.");
    }
    return saveDeal(deal);
  });
}

export async function editTerms(id: string, role: Role, terms: Partial<DealTerms>) {
  return withDealLock(id, async () => {
    const deal = (await getDeal(id))!;
    need(deal.status === "draft", "Terms are locked once both sides agree.");
    deal.terms = validateTerms({ ...deal.terms, ...terms });
    deal.approvals = { buyer: role === "buyer", seller: role === "seller" };
    addEvent(deal, role, "terms_edited", `${nameOf(deal, role)} changed the terms. The other side needs to agree again.`);
    return saveDeal(deal);
  });
}

export async function startCheckout(id: string, role: Role) {
  return withDealLock(id, async () => {
    const deal = (await getDeal(id))!;
    need(role === "buyer", "Only the buyer pays.", 403);
    need(deal.status === "agreed", "Both sides need to agree before paying.");
    const order = await paypal.createOrder({
      dealId: deal.id,
      amount: deal.terms.price,
      currency: deal.terms.currency,
      description: `Handshake hold: ${deal.terms.title}`,
    });
    deal.paypal.orderId = order.id;
    await saveDeal(deal);
    return order.id;
  });
}

export async function completeCheckout(id: string, role: Role, orderId: string) {
  return withDealLock(id, async () => {
    const deal = (await getDeal(id))!;
    need(role === "buyer", "Only the buyer pays.", 403);
    if (deal.status === "funded") return deal; // idempotent
    need(deal.status === "agreed", "This deal isn't waiting for payment.");
    need(deal.paypal.orderId && deal.paypal.orderId === orderId, "That PayPal order doesn't belong to this deal.", 400);
    const auth = await paypal.authorizeOrder(orderId);
    if (paypal.paypalConfigured) {
      need(auth.orderDealId === deal.id, "PayPal order mismatch.", 400);
      need(auth.amount === deal.terms.price, "The authorized amount doesn't match the deal.", 400);
    }
    deal.paypal.authorizationId = auth.authorizationId;
    deal.paypal.authorizationExpiresAt = auth.expiresAt;
    deal.status = "funded";
    addEvent(deal, "paypal", "authorized", `${fmt(deal)} is on hold in ${deal.buyerName}'s PayPal account. Nobody can touch it until delivery is verified.`);
    return saveDeal(deal);
  });
}

export async function submitProof(id: string, role: Role, proof: { imageDataUrl: string | null; note: string; tracking: string }) {
  // Run the AI outside the lock (slow), then re-check state inside it.
  const before = (await getDeal(id))!;
  need(role === "seller", "Only the seller submits proof.", 403);
  need(before.status === "funded", "Proof can be added once the buyer's payment is on hold.");
  need(proof.imageDataUrl || proof.tracking || proof.note, "Add a photo, a tracking number, or a note.", 400);
  if (proof.imageDataUrl) {
    need(ai.parseDataUrl(proof.imageDataUrl), "Upload a JPG, PNG, WebP, or GIF image.", 400);
    need(proof.imageDataUrl.length < 4_500_000, "That image is too large. Try one under 3 MB.", 413);
  }
  const clean = { imageDataUrl: proof.imageDataUrl, note: proof.note.slice(0, 1000), tracking: proof.tracking.slice(0, 60) };
  const verification = await ai.verifyProof(before, clean);

  return withDealLock(id, async () => {
    const deal = (await getDeal(id))!;
    need(deal.status === "funded", "This deal changed while the proof was being checked. Refresh and try again.");
    deal.proof = { ...clean, submittedAt: new Date().toISOString(), verification };
    addEvent(deal, role, "proof_submitted", `${deal.sellerName} submitted proof of delivery.`);
    addEvent(
      deal,
      "ai",
      "proof_checked",
      `Proof check: ${verification.verdict} (${Math.round(verification.confidence * 100)}% confident). ${verification.summary}`,
    );

    // Deterministic policy: the AI recommends, these rules decide.
    const autoRelease =
      verification.verdict === "pass" && verification.confidence >= AUTO_RELEASE_CONFIDENCE && !verification.manipulationDetected;
    if (autoRelease) {
      try {
        await settle(deal, 100, "Proof verified. Payment released to the seller.");
      } catch (e) {
        addEvent(deal, "system", "release_failed", `Proof passed, but PayPal couldn't release the money yet: ${(e as Error).message}. The hold is still in place.`);
      }
    } else if (verification.verdict === "fail" || verification.manipulationDetected) {
      deal.status = "disputed";
      deal.dispute = {
        openedBy: "ai",
        reason: verification.manipulationDetected ? "The proof tried to manipulate the AI checker." : "The proof doesn't match the agreed terms.",
        statements: {},
        ruling: null,
      };
      addEvent(deal, "ai", "dispute_opened", "The money stays on hold. Both sides can explain what happened, then the mediator decides.");
    } else {
      addEvent(deal, "ai", "needs_more", "Not enough evidence yet. The seller can add more proof, or the buyer can confirm delivery.");
    }
    return saveDeal(deal);
  });
}

export async function buyerConfirm(id: string, role: Role) {
  return withDealLock(id, async () => {
    const deal = (await getDeal(id))!;
    need(role === "buyer", "Only the buyer can confirm they received it.", 403);
    need(deal.status === "funded", "There's no payment on hold to release.");
    addEvent(deal, "buyer", "confirmed", `${deal.buyerName} confirmed they received it.`);
    await settle(deal, 100, "Buyer confirmed delivery. Payment released to the seller.");
    return saveDeal(deal);
  });
}

export async function openDispute(id: string, role: Role, statement: string) {
  return withDealLock(id, async () => {
    const deal = (await getDeal(id))!;
    need(deal.status === "funded" || deal.status === "disputed", "You can only raise a problem while money is on hold.");
    need(statement.trim().length >= 5, "Describe what happened in a sentence or two.", 400);
    if (!deal.dispute) {
      deal.dispute = { openedBy: role, reason: `${nameOf(deal, role)} reported a problem.`, statements: {}, ruling: null };
      deal.status = "disputed";
      addEvent(deal, role, "dispute_opened", `${nameOf(deal, role)} reported a problem. The money stays on hold.`);
    } else {
      addEvent(deal, role, "statement", `${nameOf(deal, role)} added their side of the story.`);
    }
    need(!deal.dispute.ruling, "The mediator already decided this deal.");
    deal.dispute.statements[role] = statement.trim().slice(0, 1500);
    return saveDeal(deal);
  });
}

export async function runMediation(id: string) {
  const before = (await getDeal(id))!;
  need(before.status === "disputed" && before.dispute && !before.dispute.ruling, "There's no open dispute to decide.");
  need(
    before.dispute.statements.buyer || before.dispute.statements.seller,
    "At least one side needs to explain what happened first.",
    400,
  );
  const ruling = await ai.mediate(before);
  return withDealLock(id, async () => {
    const deal = (await getDeal(id))!;
    need(deal.status === "disputed" && deal.dispute && !deal.dispute.ruling, "This dispute was already decided.");
    deal.dispute.ruling = ruling;
    addEvent(deal, "ai", "ruling", `Mediator: ${ruling.reasoning}`);
    await settle(
      deal,
      ruling.sellerShare,
      ruling.outcome === "release_to_seller"
        ? "Mediator released the payment to the seller."
        : ruling.outcome === "refund_buyer"
          ? "Mediator cancelled the hold. The buyer keeps their money."
          : `Mediator split the payment: ${ruling.sellerShare}% to the seller, the rest stays with the buyer.`,
    );
    return saveDeal(deal);
  });
}

/** The only place money moves. Must be called inside withDealLock. */
async function settle(deal: Deal, sellerPercent: number, message: string) {
  need(deal.paypal.authorizationId, "There's no PayPal hold on this deal.");
  need(!deal.paypal.captureId, "This deal was already settled.");
  const amount = paypal.shareOf(deal.terms.price, sellerPercent);

  if (Number(amount) <= 0) {
    await paypal.voidAuthorization(deal.paypal.authorizationId, deal.id);
    deal.status = "refunded";
    addEvent(deal, "paypal", "voided", `Hold cancelled. ${fmt(deal)} was never charged.`);
    addEvent(deal, "system", "settled", message);
    return;
  }

  const cap = await paypal.captureAuthorization({
    authorizationId: deal.paypal.authorizationId,
    amount,
    currency: deal.terms.currency,
    dealId: deal.id,
  });
  deal.paypal.captureId = cap.captureId;
  deal.paypal.capturedAmount = amount;
  deal.status = sellerPercent >= 100 ? "released" : "split";
  addEvent(
    deal,
    "paypal",
    "captured",
    sellerPercent >= 100
      ? `${fmt(deal, amount)} captured for ${deal.sellerName}.`
      : `${fmt(deal, amount)} captured for ${deal.sellerName}. The rest of the hold was released back to ${deal.buyerName}.`,
  );

  if (deal.sellerPaypalEmail && paypal.payoutsEnabled) {
    try {
      deal.paypal.payoutBatchId = await paypal.createPayout({
        dealId: deal.id,
        email: deal.sellerPaypalEmail,
        amount,
        currency: deal.terms.currency,
        note: `Payment for "${deal.terms.title}" through Handshake.`,
      });
      addEvent(deal, "paypal", "payout_sent", `Payout sent to ${deal.sellerPaypalEmail}.`);
    } catch (e) {
      addEvent(deal, "system", "payout_failed", `Payout to the seller failed: ${(e as Error).message}. The captured funds are safe in the Handshake account.`);
    }
  }
  addEvent(deal, "system", "settled", message);
}

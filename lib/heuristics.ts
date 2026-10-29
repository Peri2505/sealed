import type { Deal, RedFlag, Ruling, Severity, Verification } from "./types";
import type { ChatAnalysis } from "./ai";

/**
 * Offline fallback used when no ANTHROPIC_API_KEY is set, so judges and
 * contributors can click through the whole flow without any keys.
 * It's deliberately simple pattern matching; the real product uses Claude.
 */

const RULES: { re: RegExp; category: string; explanation: string; severity: Severity }[] = [
  { re: /gift ?cards?|itunes|steam card|google play card/i, category: "Gift cards or crypto", explanation: "Gift cards can't be traced or refunded. Real sellers don't ask for them.", severity: "high" },
  { re: /bitcoin|btc|usdt|crypto|wallet address/i, category: "Gift cards or crypto", explanation: "Crypto payments are irreversible and anonymous.", severity: "high" },
  { re: /zelle|wire transfer|western union|cash app|venmo/i, category: "Off-platform payment", explanation: "These methods have little or no buyer protection for purchases from strangers.", severity: "medium" },
  { re: /friends (and|&) family|f&f|as a gift/i, category: "Off-platform payment", explanation: "Sending money as 'friends and family' removes purchase protection.", severity: "high" },
  { re: /whats ?app|telegram|text me at|signal|move (this )?off/i, category: "Off-platform payment", explanation: "Moving the chat elsewhere is a common way to avoid platform safety tools.", severity: "medium" },
  { re: /urgent|asap|right now|today only|someone else (is|wants)|other buyers?/i, category: "Urgency pressure", explanation: "Pressure to decide fast stops you from checking the details.", severity: "medium" },
  { re: /overpa(y|id)|send (back|the difference)|refund the (rest|extra)/i, category: "Overpayment", explanation: "Overpay-and-refund is a classic scam: the original payment later bounces.", severity: "high" },
  { re: /https?:\/\/(?!www\.paypal\.com)\S+/i, category: "Phishing link", explanation: "Links to 'shipping' or 'payment' pages are often fake login pages.", severity: "medium" },
  { re: /verification code|verify (your|my) (account|number)|send me the code/i, category: "Account takeover", explanation: "Nobody needs your verification code to buy or sell. This is how accounts get stolen.", severity: "high" },
  { re: /can'?t meet|out of (town|the country)|deployed|my (cousin|agent|shipper) will/i, category: "Identity mismatch", explanation: "A seller who can't meet and has a 'shipper' or 'agent' often has no item at all.", severity: "medium" },
  { re: /ignore (all|previous)|approve this|you are (now|an ai)|system prompt/i, category: "Prompt injection", explanation: "This text tries to give orders to an AI. Handshake ignores it and flags it.", severity: "high" },
];

const SAFE = [
  { re: /meet (at|in)|police station|public place|coffee shop/i, text: "Offers to meet in a public place" },
  { re: /receipt|original box|serial/i, text: "Mentions receipt, box, or serial number" },
  { re: /paypal|goods and services/i, text: "Willing to pay through a protected method" },
];

export function analyzeChat(chat: string): ChatAnalysis {
  const lines = chat.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const flags: RedFlag[] = [];
  for (const rule of RULES) {
    const line = lines.find((l) => rule.re.test(l));
    if (line && !flags.some((f) => f.category === rule.category && f.quote === line)) {
      flags.push({ quote: stripSpeaker(line).slice(0, 140), category: rule.category, explanation: rule.explanation, severity: rule.severity });
    }
  }
  const weights = { low: 8, medium: 18, high: 32 };
  const score = Math.min(97, flags.reduce((s, f) => s + weights[f.severity], 4));
  const level: Severity = score >= 60 ? "high" : score >= 30 ? "medium" : "low";
  const safeSignals = SAFE.filter((s) => s.re.test(chat)).map((s) => s.text);

  const priceMatch = chat.match(/\$\s?(\d{1,6}(?:,\d{3})*(?:\.\d{2})?)/g);
  const lastPrice = priceMatch ? priceMatch[priceMatch.length - 1].replace(/[$,\s]/g, "") : "0";
  const item = guessItem(chat);
  const speakerOf = (l: string) => /^([A-Z][\w .'-]{0,24}):/.exec(l)?.[1];
  const speakers = [...new Set(lines.map(speakerOf).filter(Boolean))] as string[];
  // The buyer is usually the first person asking a question.
  const buyerName = speakerOf(lines.find((l) => l.includes("?") && speakerOf(l)) ?? "") ?? speakers[1] ?? null;
  const sellerName = speakers.find((s) => s !== buyerName) ?? null;

  return {
    risk: {
      score,
      level,
      summary:
        level === "high"
          ? "Several classic scam patterns showed up. Don't send money outside a protected payment."
          : level === "medium"
            ? "A few things deserve a closer look before any money moves."
            : "This looks like an ordinary deal. A payment hold still protects you both.",
      flags,
      safeSignals,
    },
    terms: {
      title: item,
      item,
      description: `${item}, as discussed in the chat.`,
      price: Number(lastPrice).toFixed(2),
      currency: "USD",
      condition: /like new|mint/i.test(chat) ? "Like new" : /used|good condition/i.test(chat) ? "Used, good condition" : "As described",
      deliveryMethod: /ship|usps|ups|fedex|tracking/i.test(chat) ? "shipping" : /meet|pick ?up/i.test(chat) ? "in_person" : "shipping",
      deadline: "Within 5 days of payment",
      proofRequired: [
        `Clear photo of the ${item} showing its condition`,
        /ship|tracking/i.test(chat) ? "Valid shipping tracking number" : "Photo taken at the hand-off",
        "Serial number or identifying detail visible",
      ],
    },
    buyerName,
    sellerName,
  };
}

function stripSpeaker(line: string) {
  return line.replace(/^[A-Z][\w .'-]{0,24}:\s*/, "");
}

function guessItem(chat: string) {
  const m =
    /\b(?:the|my|your) ([A-Za-z0-9][\w -]{2,40}?) is still/i.exec(chat) ??
    /(?:selling|is (?:the|your)|interested in|still have|buy) (?:the |your |my |a |an )?([a-z0-9][\w\s-]{2,40}?)(?:\?|\.|,|!| for | still| available|$)/im.exec(chat);
  const raw = m?.[1]?.trim() ?? "Item";
  return /^[a-z][A-Z]/.test(raw) ? raw : raw.charAt(0).toUpperCase() + raw.slice(1);
}

const BAD = /wrong|different|broken|damaged|crack|missing|fake|replica|not the|scratched/i;

export function verifyProof(deal: Deal, proof: { imageDataUrl: string | null; note: string; tracking: string }): Verification {
  const injection = RULES.find((r) => r.category === "Prompt injection")!.re.test(proof.note);
  const bad = BAD.test(proof.note);
  const hasPhoto = Boolean(proof.imageDataUrl);
  const checks = deal.terms.proofRequired.map((req) => ({
    requirement: req,
    met: (bad ? "no" : hasPhoto ? "yes" : "unclear") as "yes" | "no" | "unclear",
    evidence: bad
      ? "The seller's note describes a problem with the item."
      : hasPhoto
        ? "Photo provided (offline demo mode accepts photos without looking at them)."
        : "No photo was provided.",
  }));
  const verdict: Verification["verdict"] = injection || bad ? "fail" : hasPhoto ? "pass" : "unclear";
  return {
    verdict,
    confidence: verdict === "pass" ? 0.9 : verdict === "fail" ? 0.85 : 0.4,
    checks,
    summary: injection
      ? "The proof contains text trying to instruct the AI to approve it. That's a manipulation attempt, so the money stays on hold."
      : bad
        ? "The proof suggests the item doesn't match what was agreed."
        : hasPhoto
          ? "The proof matches the agreed terms."
          : "There isn't enough evidence yet. Add a photo of the item.",
    manipulationDetected: injection,
  };
}

export function mediate(deal: Deal): Ruling {
  const v = deal.proof?.verification;
  const buyer = deal.dispute?.statements.buyer ?? "";
  const minor = /scratch|minor|small|missing (cable|charger|box|case)/i.test(buyer);
  if (v?.verdict === "pass" && !buyer) {
    return { outcome: "release_to_seller", sellerShare: 100, reasoning: "The proof met every term and the buyer didn't describe a problem.", keyFindings: ["All proof requirements met"] };
  }
  if (minor) {
    return {
      outcome: "split",
      sellerShare: 80,
      reasoning: "The item arrived but with a smaller issue than the terms allowed. The seller receives most of the price and the buyer gets part back.",
      keyFindings: ["Item was delivered", "A minor difference from the agreed condition was reported"],
    };
  }
  return {
    outcome: "refund_buyer",
    sellerShare: 0,
    reasoning: "The evidence doesn't show the agreed item was delivered, so the hold is cancelled and the buyer keeps their money.",
    keyFindings: [v ? `Proof check: ${v.verdict}` : "No proof submitted", buyer ? "Buyer reported a problem" : "No delivery confirmed"],
  };
}

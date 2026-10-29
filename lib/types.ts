export type Role = "buyer" | "seller";
export type Severity = "low" | "medium" | "high";

export type DealStatus =
  | "draft" // terms written, waiting for both sides to agree
  | "agreed" // both agreed, waiting for buyer to fund
  | "funded" // PayPal authorization holds the buyer's money
  | "disputed" // proof failed or a side raised a problem
  | "released" // captured in full for the seller
  | "refunded" // authorization voided, buyer keeps their money
  | "split"; // partial capture, rest returned to buyer

export interface RedFlag {
  quote: string;
  category: string;
  explanation: string;
  severity: Severity;
}

export interface RiskReport {
  score: number; // 0 (safe) – 100 (almost certainly a scam)
  level: Severity;
  summary: string;
  flags: RedFlag[];
  safeSignals: string[];
}

export interface DealTerms {
  title: string;
  item: string;
  description: string;
  price: string; // "400.00"
  currency: string; // "USD"
  condition: string;
  deliveryMethod: "shipping" | "in_person" | "digital" | "service";
  deadline: string; // human readable, e.g. "Within 5 days"
  proofRequired: string[];
}

export interface Verification {
  verdict: "pass" | "fail" | "unclear";
  confidence: number; // 0–1
  checks: { requirement: string; met: "yes" | "no" | "unclear"; evidence: string }[];
  summary: string;
  manipulationDetected: boolean;
}

export interface Ruling {
  outcome: "release_to_seller" | "refund_buyer" | "split";
  sellerShare: number; // 0–100 (% of price the seller receives)
  reasoning: string;
  keyFindings: string[];
}

export interface DealEvent {
  at: string;
  actor: Role | "ai" | "paypal" | "system";
  type: string;
  message: string;
}

export interface Deal {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: DealStatus;
  terms: DealTerms;
  risk: RiskReport | null;
  buyerName: string;
  sellerName: string;
  sellerPaypalEmail: string | null;
  approvals: Record<Role, boolean>;
  tokens: Record<Role, string>; // secret link tokens, never sent to the other side
  paypal: {
    orderId: string | null;
    authorizationId: string | null;
    authorizationExpiresAt: string | null;
    captureId: string | null;
    capturedAmount: string | null;
    payoutBatchId: string | null;
    simulated: boolean;
  };
  proof: {
    imageDataUrl: string | null;
    note: string;
    tracking: string;
    submittedAt: string;
    verification: Verification | null;
  } | null;
  dispute: {
    openedBy: Role | "ai";
    reason: string;
    statements: Partial<Record<Role, string>>;
    ruling: Ruling | null;
  } | null;
  events: DealEvent[];
}

/** What the browser is allowed to see. Tokens are stripped. */
export type PublicDeal = Omit<Deal, "tokens"> & { viewerRole: Role | null };

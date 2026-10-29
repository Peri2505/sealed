import { createDeal } from "@/lib/deals";
import { fail, json, readBody } from "@/lib/http";
import { toPublic } from "@/lib/store";
import type { DealTerms, RiskReport, Role } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const b = await readBody<{
      terms: Partial<DealTerms>;
      risk?: RiskReport | null;
      buyerName?: string;
      sellerName?: string;
      sellerPaypalEmail?: string;
      creatorRole?: Role;
    }>(req);
    const role: Role = b.creatorRole === "seller" ? "seller" : "buyer";
    const deal = await createDeal({ ...b, terms: b.terms ?? {}, risk: b.risk ?? null, creatorRole: role });
    const base = process.env.APP_URL || new URL(req.url).origin;
    return json(
      {
        deal: toPublic(deal, role),
        links: {
          buyer: `${base}/deal/${deal.id}?t=${deal.tokens.buyer}`,
          seller: `${base}/deal/${deal.id}?t=${deal.tokens.seller}`,
        },
      },
      201,
    );
  } catch (e) {
    return fail(e);
  }
}

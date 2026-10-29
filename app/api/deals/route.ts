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
    const base = publicOrigin(req);
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

/** The address people use to reach the app. Behind a proxy (Render), req.url is the internal address. */
function publicOrigin(req: Request) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0] || "https";
  return host ? `${proto}://${host}` : new URL(req.url).origin;
}

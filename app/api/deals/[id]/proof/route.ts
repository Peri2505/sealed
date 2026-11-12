import { submitProof } from "@/lib/deals";
import { limitAiCall } from "@/lib/ratelimit";
import { type Ctx, fail, pub, readBody, viewer } from "@/lib/http";

export const maxDuration = 60;

export async function POST(req: Request, ctx: Ctx) {
  try {
    const { id, role } = await viewer(req, ctx);
    limitAiCall(req);
    const b = await readBody<{ imageDataUrls?: unknown; imageDataUrl?: string | null; note?: string; tracking?: string }>(req);
    // Accept the newer list of photos, or a single photo from older clients.
    const images = Array.isArray(b.imageDataUrls)
      ? b.imageDataUrls.filter((x): x is string => typeof x === "string" && x.length > 0)
      : b.imageDataUrl ? [b.imageDataUrl] : [];
    const deal = await submitProof(id, role, {
      images,
      note: String(b.note || ""),
      tracking: String(b.tracking || ""),
    });
    return pub(deal, role);
  } catch (e) {
    return fail(e);
  }
}

import { submitProof } from "@/lib/deals";
import { type Ctx, fail, pub, readBody, viewer } from "@/lib/http";

export const maxDuration = 60;

export async function POST(req: Request, ctx: Ctx) {
  try {
    const { id, role } = await viewer(req, ctx);
    const b = await readBody<{ imageDataUrl?: string | null; note?: string; tracking?: string }>(req);
    const deal = await submitProof(id, role, {
      imageDataUrl: b.imageDataUrl || null,
      note: String(b.note || ""),
      tracking: String(b.tracking || ""),
    });
    return pub(deal, role);
  } catch (e) {
    return fail(e);
  }
}

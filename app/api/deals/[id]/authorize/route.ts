import { completeCheckout } from "@/lib/deals";
import { type Ctx, fail, pub, readBody, viewer } from "@/lib/http";

/** Called by the PayPal button's onApprove: places the hold on the buyer's funds. */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const { id, role } = await viewer(req, ctx);
    const { orderId } = await readBody<{ orderId: string }>(req);
    return pub(await completeCheckout(id, role, String(orderId || "")), role);
  } catch (e) {
    return fail(e);
  }
}

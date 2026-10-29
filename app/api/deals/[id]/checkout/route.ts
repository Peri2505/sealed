import { startCheckout } from "@/lib/deals";
import { type Ctx, fail, json, viewer } from "@/lib/http";

/** Creates the PayPal order (intent=AUTHORIZE). Called by the PayPal button's createOrder. */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const { id, role } = await viewer(req, ctx);
    return json({ orderId: await startCheckout(id, role) });
  } catch (e) {
    return fail(e);
  }
}

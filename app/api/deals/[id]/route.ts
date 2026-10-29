import { type Ctx, fail, pub, viewer } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: Ctx) {
  try {
    const { deal, role } = await viewer(req, ctx);
    return pub(deal, role);
  } catch (e) {
    return fail(e);
  }
}

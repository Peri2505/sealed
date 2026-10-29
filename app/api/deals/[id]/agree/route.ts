import { agree } from "@/lib/deals";
import { type Ctx, fail, pub, viewer } from "@/lib/http";

export async function POST(req: Request, ctx: Ctx) {
  try {
    const { id, role } = await viewer(req, ctx);
    return pub(await agree(id, role), role);
  } catch (e) {
    return fail(e);
  }
}

import { openDispute } from "@/lib/deals";
import { type Ctx, fail, pub, readBody, viewer } from "@/lib/http";

export async function POST(req: Request, ctx: Ctx) {
  try {
    const { id, role } = await viewer(req, ctx);
    const { statement } = await readBody<{ statement: string }>(req);
    return pub(await openDispute(id, role, String(statement || "")), role);
  } catch (e) {
    return fail(e);
  }
}

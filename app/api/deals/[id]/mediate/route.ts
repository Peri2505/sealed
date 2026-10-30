import { runMediation } from "@/lib/deals";
import { limitAiCall } from "@/lib/ratelimit";
import { type Ctx, fail, pub, viewer } from "@/lib/http";

export const maxDuration = 60;

export async function POST(req: Request, ctx: Ctx) {
  try {
    const { id, role } = await viewer(req, ctx);
    limitAiCall(req);
    return pub(await runMediation(id), role);
  } catch (e) {
    return fail(e);
  }
}

import { editTerms } from "@/lib/deals";
import { type Ctx, fail, pub, readBody, viewer } from "@/lib/http";
import type { DealTerms } from "@/lib/types";

export async function PUT(req: Request, ctx: Ctx) {
  try {
    const { id, role } = await viewer(req, ctx);
    const { terms } = await readBody<{ terms: Partial<DealTerms> }>(req);
    return pub(await editTerms(id, role, terms ?? {}), role);
  } catch (e) {
    return fail(e);
  }
}

import { analyzeChat, parseDataUrl } from "@/lib/ai";
import { DealError } from "@/lib/deals";
import { fail, json, readBody } from "@/lib/http";
import { limitAiCall } from "@/lib/ratelimit";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { chat = "", screenshot = null } = await readBody<{ chat?: string; screenshot?: string | null }>(req);
    limitAiCall(req);
    if (!chat.trim() && !screenshot) throw new DealError("Paste the conversation or add a screenshot first.", 400);
    if (screenshot && !parseDataUrl(screenshot)) throw new DealError("Screenshots must be JPG, PNG, WebP, or GIF.", 400);
    if (screenshot && screenshot.length > 4_500_000) throw new DealError("That screenshot is too large. Try one under 3 MB.", 413);
    return json(await analyzeChat(String(chat), screenshot));
  } catch (e) {
    return fail(e);
  }
}

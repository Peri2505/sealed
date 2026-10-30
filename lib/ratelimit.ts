import "server-only";
import { DealError } from "./deals";

/**
 * Rate limits for the endpoints that call the AI model, so nobody can drain the
 * API budget by hammering them. In-memory sliding windows: right for a single
 * instance (the demo); swap for Redis when running several instances.
 *
 *   per client: a short burst limit and an hourly limit, keyed by IP
 *   global:     a daily ceiling on AI calls across everyone (a hard cost cap)
 */
const PER_MINUTE = Number(process.env.AI_LIMIT_PER_MINUTE ?? 6);
const PER_HOUR = Number(process.env.AI_LIMIT_PER_HOUR ?? 40);
const GLOBAL_PER_DAY = Number(process.env.AI_LIMIT_GLOBAL_PER_DAY ?? 1500);
const disabled = process.env.RATE_LIMIT_DISABLED === "1";

const hits = new Map<string, number[]>();
let global: number[] = [];

function clientKey(req: Request) {
  // Render (and most hosts) put the real client first in X-Forwarded-For.
  const xff = req.headers.get("x-forwarded-for");
  const ip = xff?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  return ip.slice(0, 64);
}

function prune(list: number[], windowMs: number, now: number) {
  let i = 0;
  while (i < list.length && now - list[i] > windowMs) i++;
  return i ? list.slice(i) : list;
}

/** Throws a 429 DealError when the caller is over a limit; otherwise records the hit. */
export function limitAiCall(req: Request) {
  if (disabled) return;
  const now = Date.now();
  const key = clientKey(req);
  const mine = prune(hits.get(key) ?? [], 3_600_000, now);
  global = prune(global, 86_400_000, now);

  const lastMinute = mine.filter((t) => now - t < 60_000).length;
  if (lastMinute >= PER_MINUTE) throw new DealError("You're going a bit fast. Wait a minute and try again.", 429);
  if (mine.length >= PER_HOUR) throw new DealError("You've reached the hourly limit for AI checks. Try again later.", 429);
  if (global.length >= GLOBAL_PER_DAY) throw new DealError("The demo has reached today's limit for AI checks. Try again tomorrow.", 429);

  mine.push(now);
  global.push(now);
  hits.set(key, mine);
  if (hits.size > 10_000) hits.clear(); // memory guard
}

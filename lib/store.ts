import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { randomBytes, timingSafeEqual } from "crypto";
import type { Deal, DealEvent, PublicDeal, Role } from "./types";

/**
 * Tiny JSON-file store. Good enough for a hackathon demo, easy to swap for a
 * real database later: every read/write goes through these functions.
 */
const DATA_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR || ".data");
const FILE = path.join(DATA_DIR, "deals.json");

let cache: Record<string, Deal> | null = null;
let writeChain: Promise<void> = Promise.resolve();

async function load(): Promise<Record<string, Deal>> {
  if (cache) return cache;
  try {
    cache = JSON.parse(await fs.readFile(FILE, "utf8"));
  } catch {
    cache = {};
  }
  return cache!;
}

async function persist() {
  const snapshot = JSON.stringify(cache ?? {}, null, 2);
  writeChain = writeChain.then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tmp = `${FILE}.${process.pid}.tmp`;
    await fs.writeFile(tmp, snapshot);
    await fs.rename(tmp, FILE); // atomic replace
  });
  return writeChain;
}

export function newId(bytes = 6) {
  return randomBytes(bytes).toString("base64url");
}

export async function getDeal(id: string): Promise<Deal | null> {
  const db = await load();
  // Return a copy so a failed operation never leaks half-applied changes.
  return db[id] ? structuredClone(db[id]) : null;
}

export async function findDealByOrderOrAuth(ref: { dealId?: string | null; authorizationId?: string | null }) {
  const db = await load();
  if (ref.dealId && db[ref.dealId]) return structuredClone(db[ref.dealId]);
  const hit = Object.values(db).find((d) => ref.authorizationId && d.paypal.authorizationId === ref.authorizationId);
  return hit ? structuredClone(hit) : null;
}

export async function saveDeal(deal: Deal): Promise<Deal> {
  const db = await load();
  deal.updatedAt = new Date().toISOString();
  db[deal.id] = structuredClone(deal);
  await persist();
  return deal;
}

/**
 * Per-deal mutex. Money operations (capture, void, refund) must never run
 * twice for the same deal, even if a user double-clicks or a webhook races.
 */
const locks = new Map<string, Promise<unknown>>();
export async function withDealLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(id) ?? Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>((r) => (release = r));
  locks.set(id, prev.then(() => next));
  await prev.catch(() => {});
  try {
    return await fn();
  } finally {
    release();
    if (locks.get(id) === next) locks.delete(id);
  }
}

export function addEvent(deal: Deal, actor: DealEvent["actor"], type: string, message: string) {
  deal.events.push({ at: new Date().toISOString(), actor, type, message });
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function roleForToken(deal: Deal, token: string | null | undefined): Role | null {
  if (!token) return null;
  if (safeEqual(token, deal.tokens.buyer)) return "buyer";
  if (safeEqual(token, deal.tokens.seller)) return "seller";
  return null;
}

export function toPublic(deal: Deal, viewerRole: Role | null): PublicDeal {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { tokens, ...rest } = deal;
  return { ...rest, viewerRole };
}

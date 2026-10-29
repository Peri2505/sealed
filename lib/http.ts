import "server-only";
import { NextResponse } from "next/server";
import { DealError, loadForViewer } from "./deals";
import { PayPalError } from "./paypal";
import { toPublic } from "./store";
import type { Deal, Role } from "./types";

export type Ctx = { params: Promise<{ id: string }> };

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function fail(e: unknown) {
  if (e instanceof DealError) return json({ error: e.message }, e.status);
  if (e instanceof PayPalError) {
    console.error("[paypal]", e.status, JSON.stringify(e.details));
    return json({ error: e.message }, 502);
  }
  console.error(e);
  return json({ error: "Something went wrong on our side. Try again in a moment." }, 500);
}

export async function readBody<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new DealError("The request body must be JSON.", 400);
  }
}

/** Resolve the caller's role from their secret link token. */
export async function viewer(req: Request, ctx: Ctx): Promise<{ deal: Deal; role: Role; id: string }> {
  const { id } = await ctx.params;
  const token = req.headers.get("x-deal-token") || new URL(req.url).searchParams.get("t");
  const { deal, role } = await loadForViewer(id, token);
  return { deal, role, id };
}

export const pub = (deal: Deal, role: Role) => json({ deal: toPublic(deal, role) });

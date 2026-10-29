import "server-only";
import { randomUUID } from "crypto";

/**
 * PayPal REST integration (sandbox).
 *
 * Handshake uses the authorize-then-capture pattern of Orders v2 as a
 * payment hold:
 *   1. createOrder (intent=AUTHORIZE)   buyer approves in PayPal Checkout
 *   2. authorizeOrder                   money is reserved on the buyer's account
 *   3a. captureAuthorization            seller gets paid (full or partial)
 *   3b. voidAuthorization               hold is cancelled, buyer keeps the money
 *   4. refundCapture                    safety valve after a capture
 *   5. createPayout (optional)          forward the seller's share to their PayPal email
 *
 * If no credentials are configured, every call is simulated so the app can
 * still be explored locally. The UI clearly labels simulated payments.
 */

const BASE =
  process.env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

export const paypalConfigured = Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);

let tokenCache: { token: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.token;
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!res.ok) throw new PayPalError("Could not sign in to PayPal. Check PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.", res.status);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

export class PayPalError extends Error {
  constructor(message: string, public status = 500, public details?: unknown) {
    super(message);
  }
}

async function call<T>(method: string, path: string, body?: unknown, requestId?: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "Content-Type": "application/json",
      // Idempotency: retrying the same request never moves money twice.
      ...(requestId ? { "PayPal-Request-Id": requestId } : {}),
      Prefer: "return=representation",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const issue = json?.details?.[0]?.description || json?.message || res.statusText;
    throw new PayPalError(`PayPal: ${issue}`, res.status, json);
  }
  return json as T;
}

const fake = (prefix: string) => `SIM-${prefix}-${randomUUID().slice(0, 8).toUpperCase()}`;

export async function createOrder(opts: {
  dealId: string;
  amount: string;
  currency: string;
  description: string;
}): Promise<{ id: string }> {
  if (!paypalConfigured) return { id: fake("ORDER") };
  return call<{ id: string }>(
    "POST",
    "/v2/checkout/orders",
    {
      intent: "AUTHORIZE",
      purchase_units: [
        {
          reference_id: opts.dealId,
          custom_id: opts.dealId,
          description: opts.description.slice(0, 127),
          amount: { currency_code: opts.currency, value: opts.amount },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: "Handshake",
            shipping_preference: "NO_SHIPPING",
            user_action: "CONTINUE",
          },
        },
      },
    },
    `order-${opts.dealId}`,
  );
}

export interface AuthorizationResult {
  authorizationId: string;
  status: string;
  expiresAt: string | null;
  orderDealId: string | null;
  amount: string | null;
}

export async function authorizeOrder(orderId: string): Promise<AuthorizationResult> {
  if (!paypalConfigured) {
    return {
      authorizationId: fake("AUTH"),
      status: "CREATED",
      expiresAt: new Date(Date.now() + 29 * 864e5).toISOString(),
      orderDealId: null,
      amount: null,
    };
  }
  type Resp = {
    purchase_units: {
      custom_id?: string;
      payments: { authorizations: { id: string; status: string; expiration_time?: string; amount: { value: string } }[] };
    }[];
  };
  const json = await call<Resp>("POST", `/v2/checkout/orders/${encodeURIComponent(orderId)}/authorize`, {}, `auth-${orderId}`);
  const unit = json.purchase_units[0];
  const auth = unit.payments.authorizations[0];
  return {
    authorizationId: auth.id,
    status: auth.status,
    expiresAt: auth.expiration_time ?? null,
    orderDealId: unit.custom_id ?? null,
    amount: auth.amount?.value ?? null,
  };
}

export async function getOrder(orderId: string) {
  if (!paypalConfigured) return null;
  return call<{ id: string; status: string; purchase_units: { custom_id?: string; amount: { value: string; currency_code: string } }[] }>(
    "GET",
    `/v2/checkout/orders/${encodeURIComponent(orderId)}`,
  );
}

export async function captureAuthorization(opts: {
  authorizationId: string;
  amount: string;
  currency: string;
  dealId: string;
}): Promise<{ captureId: string; status: string }> {
  if (!paypalConfigured) return { captureId: fake("CAPTURE"), status: "COMPLETED" };
  const json = await call<{ id: string; status: string }>(
    "POST",
    `/v2/payments/authorizations/${encodeURIComponent(opts.authorizationId)}/capture`,
    {
      amount: { currency_code: opts.currency, value: opts.amount },
      final_capture: true, // anything not captured goes back to the buyer
      invoice_id: `handshake-${opts.dealId}`,
      note_to_payer: "Released by Handshake after delivery was verified.",
    },
    `capture-${opts.dealId}`,
  );
  return { captureId: json.id, status: json.status };
}

export async function voidAuthorization(authorizationId: string, dealId: string): Promise<void> {
  if (!paypalConfigured) return;
  await call("POST", `/v2/payments/authorizations/${encodeURIComponent(authorizationId)}/void`, undefined, `void-${dealId}`);
}

export async function refundCapture(opts: { captureId: string; amount?: string; currency: string; dealId: string }) {
  if (!paypalConfigured) return { refundId: fake("REFUND") };
  const json = await call<{ id: string }>(
    "POST",
    `/v2/payments/captures/${encodeURIComponent(opts.captureId)}/refund`,
    opts.amount ? { amount: { value: opts.amount, currency_code: opts.currency } } : {},
    `refund-${opts.dealId}`,
  );
  return { refundId: json.id };
}

export const payoutsEnabled = paypalConfigured && process.env.PAYPAL_PAYOUTS_ENABLED === "true";

export async function createPayout(opts: { dealId: string; email: string; amount: string; currency: string; note: string }) {
  if (!payoutsEnabled) return null;
  const json = await call<{ batch_header: { payout_batch_id: string } }>(
    "POST",
    "/v1/payments/payouts",
    {
      sender_batch_header: {
        sender_batch_id: `handshake-${opts.dealId}`,
        email_subject: "You've been paid through Handshake",
      },
      items: [
        {
          recipient_type: "EMAIL",
          receiver: opts.email,
          amount: { value: opts.amount, currency: opts.currency },
          note: opts.note.slice(0, 1000),
          sender_item_id: opts.dealId,
        },
      ],
    },
    `payout-${opts.dealId}`,
  );
  return json.batch_header.payout_batch_id;
}

/** Verifies a webhook really came from PayPal before we trust it. */
export async function verifyWebhookSignature(headers: Headers, rawBody: string): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!paypalConfigured || !webhookId) return false;
  const json = await call<{ verification_status: string }>("POST", "/v1/notifications/verify-webhook-signature", {
    auth_algo: headers.get("paypal-auth-algo"),
    cert_url: headers.get("paypal-cert-url"),
    transmission_id: headers.get("paypal-transmission-id"),
    transmission_sig: headers.get("paypal-transmission-sig"),
    transmission_time: headers.get("paypal-transmission-time"),
    webhook_id: webhookId,
    webhook_event: JSON.parse(rawBody),
  });
  return json.verification_status === "SUCCESS";
}

/** Money math in integer cents to avoid floating point drift. */
export function shareOf(price: string, percent: number): string {
  const cents = Math.round(parseFloat(price) * 100);
  const p = Math.min(100, Math.max(0, Math.round(percent)));
  return (Math.floor((cents * p) / 100) / 100).toFixed(2);
}

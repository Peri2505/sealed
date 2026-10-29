"use client";

import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { useState } from "react";
import { api, money } from "@/lib/client";
import type { PublicDeal } from "@/lib/types";
import { Button, ErrorNote } from "./ui";

/**
 * PayPal Checkout with intent=authorize. The buyer approves in PayPal, then the
 * server authorizes the order, which places a hold instead of taking the money.
 */
export function PayButton({
  deal,
  token,
  clientId,
  onFunded,
}: {
  deal: PublicDeal;
  token: string;
  clientId: string | null;
  onFunded: (d: PublicDeal) => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { price, currency } = deal.terms;

  const createOrder = async () => {
    setError("");
    const { orderId } = await api<{ orderId: string }>(`/api/deals/${deal.id}/checkout`, { method: "POST", token });
    return orderId;
  };
  const authorize = async (orderId: string) => {
    const { deal: d } = await api<{ deal: PublicDeal }>(`/api/deals/${deal.id}/authorize`, { body: { orderId }, token });
    onFunded(d);
  };

  if (!clientId) {
    return (
      <div className="space-y-3">
        <Button
          className="w-full"
          busy={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await authorize(await createOrder());
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Put {money(price, currency)} on hold (simulated PayPal)
        </Button>
        <p className="text-xs text-slate">Add PayPal sandbox keys to use real PayPal Checkout.</p>
        <ErrorNote>{error}</ErrorNote>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <PayPalScriptProvider options={{ clientId, intent: "authorize", currency, components: "buttons" }}>
        <PayPalButtons
          style={{ layout: "vertical", shape: "rect", label: "pay", height: 48 }}
          forceReRender={[price, currency]}
          createOrder={createOrder}
          onApprove={async (data) => {
            try {
              await authorize(data.orderID);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
          onError={(err) => setError(`PayPal couldn't finish the payment: ${String((err as { message?: unknown })?.message ?? "unknown error")}`)}
          onCancel={() => setError("Payment cancelled. Nothing was charged.")}
        />
      </PayPalScriptProvider>
      <ErrorNote>{error}</ErrorNote>
    </div>
  );
}

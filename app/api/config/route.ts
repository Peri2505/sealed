import { json } from "@/lib/http";
import { aiConfigured } from "@/lib/ai";
import { paypalConfigured, payoutsEnabled } from "@/lib/paypal";

export const dynamic = "force-dynamic";

export function GET() {
  return json({
    // Always the client ID paired with the server's secret, so browser and server use the same PayPal app.
    paypalClientId: paypalConfigured ? process.env.PAYPAL_CLIENT_ID : null,
    paypalSimulated: !paypalConfigured,
    aiSimulated: !aiConfigured,
    payoutsEnabled,
  });
}

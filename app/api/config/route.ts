import { json } from "@/lib/http";
import { aiConfigured } from "@/lib/ai";
import { paypalConfigured, payoutsEnabled } from "@/lib/paypal";

export const dynamic = "force-dynamic";

export function GET() {
  return json({
    paypalClientId: paypalConfigured ? process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || process.env.PAYPAL_CLIENT_ID : null,
    paypalSimulated: !paypalConfigured,
    aiSimulated: !aiConfigured,
    payoutsEnabled,
  });
}

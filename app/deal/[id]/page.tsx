import { Suspense } from "react";
import { DealRoom } from "./DealRoom";

export default function Page() {
  return (
    <Suspense fallback={<p className="pt-16 text-slate">Opening the deal…</p>}>
      <DealRoom />
    </Suspense>
  );
}

// Keeps the free Render instance awake between visits.
// Render's free plan sleeps after 15 minutes without inbound traffic, and GitHub's
// scheduled workflows run too rarely to prevent it. Once the server is up, it pings
// its own public URL every 10 minutes, which counts as a visit.
export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const base = (process.env.RENDER_EXTERNAL_URL || process.env.APP_URL || "").replace(/\/$/, "");
  if (!base || process.env.KEEP_AWAKE === "off") return;
  const ping = () => fetch(`${base}/api/config`, { cache: "no-store" }).catch(() => {});
  const timer = setInterval(ping, 10 * 60 * 1000);
  timer.unref?.();
}

"use client";

export class ApiError extends Error {}

export async function api<T>(path: string, opts: { method?: string; body?: unknown; token?: string | null } = {}): Promise<T> {
  const res = await fetch(path, {
    method: opts.method ?? (opts.body ? "POST" : "GET"),
    headers: {
      "Content-Type": "application/json",
      ...(opts.token ? { "x-deal-token": opts.token } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status}).`);
  return data as T;
}

/** Shrinks an image in the browser so uploads stay small and fast. */
export async function fileToDataUrl(file: File, maxSide = 1280): Promise<string> {
  if (!file.type.startsWith("image/")) throw new ApiError("Choose an image file.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export const money = (value: string, currency = "USD") => {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(value));
  } catch {
    return `${value} ${currency}`;
  }
};

/** Links for deals created on this device, so one person can demo both sides. */
const KEY = "sealed.links";
export function rememberLinks(id: string, links: { buyer: string; seller: string }) {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) || "{}");
    all[id] = links;
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {}
}
export function recallLinks(id: string): { buyer: string; seller: string } | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}")[id] ?? null;
  } catch {
    return null;
  }
}

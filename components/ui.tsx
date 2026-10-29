"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

type Variant = "primary" | "quiet" | "danger" | "safe";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-[#232c4f] disabled:bg-slate/60",
  safe: "bg-safe text-white hover:bg-[#196b4a] disabled:bg-safe/50",
  danger: "bg-white text-risk border border-risk/40 hover:bg-risk-soft disabled:opacity-50",
  quiet: "bg-white text-ink border border-line hover:border-slate/50 disabled:opacity-50",
};

export function Button({
  variant = "primary",
  busy,
  children,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; busy?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || busy}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-[15px] font-semibold transition-colors disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {busy && <Spinner />}
      {children}
    </button>
  );
}

export function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin motion-reduce:animate-none" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity=".3" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate">{hint}</span>}
    </label>
  );
}

const inputCls =
  "w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[15px] text-ink placeholder:text-slate/70 focus:border-ink focus:outline-none";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputCls} resize-y leading-relaxed ${props.className ?? ""}`} />;
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-xl border border-risk/30 bg-risk-soft px-4 py-3 text-sm text-risk">
      {children}
    </p>
  );
}

export function DemoBadge({ what }: { what: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-hold/40 bg-hold-soft px-2.5 py-1 text-xs font-medium text-[#8a5a10]">
      <span className="h-1.5 w-1.5 rounded-full bg-hold" />
      {what}
    </span>
  );
}

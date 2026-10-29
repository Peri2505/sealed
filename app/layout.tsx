import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Handshake: safe deals between strangers",
  description:
    "Paste any marketplace chat. Handshake's AI spots scam red flags, writes the deal, and holds payment with PayPal until delivery is verified.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Instrument+Sans:wght@400;500;600&display=swap"
        />
      </head>
      <body>
        <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <Mark />
            <span className="display text-xl font-bold">Handshake</span>
          </Link>
          <Link href="/#how" className="text-sm text-slate hover:text-ink">
            How it works
          </Link>
        </header>
        <main className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 pb-10 text-xs text-slate sm:px-6">
          Built for the PayPal AI Hackathon. Payments run in the PayPal sandbox. Handshake places a payment hold; it is not a licensed escrow service.
        </footer>
      </body>
    </html>
  );
}

function Mark() {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="14.5" fill="none" stroke="#18203a" strokeWidth="2" strokeDasharray="3 2.2" />
      <path d="M8.5 17.5l4-4 3 2 3-3 5 5-3.5 3.5-2-1.5-2 1.5z" fill="#d98e1f" stroke="#18203a" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

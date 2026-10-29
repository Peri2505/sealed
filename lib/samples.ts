export const SAMPLES = {
  scam: {
    label: "A risky chat",
    chat: `Marcus: hey yes the iPhone 15 Pro is still available. $350, barely used
Jamie: That's a great price! Could we meet somewhere to look at it?
Marcus: I'm out of town for work right now, my shipper will deliver it to you
Marcus: another buyer wants it today so I need payment ASAP
Marcus: easiest is a $350 Apple gift card or Zelle
Jamie: Can I just pay with PayPal?
Marcus: ok but send it as friends and family so there are no fees
Marcus: text me on WhatsApp instead, I don't check this app much`,
  },
  honest: {
    label: "A normal deal",
    chat: `Priya: Hi! Is the PS5 Slim disc edition still available?
Leo: Yes! Like new, I barely played it. Comes with the controller, cables and original box.
Priya: Great. Would you do $400 shipped? I'm in Chicago.
Leo: $400 works. I can ship USPS Priority with tracking within 2 days.
Priya: Perfect. Can you send a photo showing the serial sticker before you ship?
Leo: Sure, I'll include the serial and a photo of everything in the box.`,
  },
} as const;

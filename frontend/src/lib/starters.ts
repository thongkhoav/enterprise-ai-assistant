import { HeartPulse, Laptop, type LucideIcon, Plane, TicketCheck, Wallet } from "lucide-react";

export type Starter = {
  icon: LucideIcon;
  kind: string;
  tone: "blue" | "amber" | "green" | "violet";
  text: string;
};

const BENEFITS_401K: Starter = {
  icon: HeartPulse,
  kind: "Benefits",
  tone: "blue",
  text: "If I earn $90,000 and put 6% in my 401(k), how much does Acme add?",
};
const HOTEL: Starter = {
  icon: Plane,
  kind: "Travel",
  tone: "amber",
  text: "What is the hotel limit in London?",
};
const VPN: Starter = {
  icon: Laptop,
  kind: "IT help",
  tone: "green",
  text: "My VPN won't connect. What should I try?",
};
const LAPTOP_TICKET: Starter = {
  icon: TicketCheck,
  kind: "IT request",
  tone: "violet",
  text: "Create a high priority ticket: my laptop screen is cracked.",
};

/**
 * Starter questions per page the assistant is embedded on (`?context=` on the widget), so a
 * question asked from the Benefits page starts with benefits questions.
 */
export const STARTERS: Record<string, Starter[]> = {
  default: [BENEFITS_401K, HOTEL, VPN, LAPTOP_TICKET],
  benefits: [
    BENEFITS_401K,
    {
      icon: HeartPulse,
      kind: "Medical",
      tone: "green",
      text: "How much of my medical premium does Acme pay?",
    },
    { icon: Wallet, kind: "Wellbeing", tone: "amber", text: "How much is the wellness stipend?" },
    {
      icon: HeartPulse,
      kind: "Enrollment",
      tone: "violet",
      text: "When is open enrollment for 2027?",
    },
  ],
  it: [
    VPN,
    { icon: Laptop, kind: "Passwords", tone: "blue", text: "How do I reset my Okta password?" },
    { icon: Laptop, kind: "Laptops", tone: "amber", text: "How often are laptops replaced?" },
    LAPTOP_TICKET,
  ],
};

export function startersFor(context: string | null | undefined): Starter[] {
  return STARTERS[context || "default"] || STARTERS.default;
}

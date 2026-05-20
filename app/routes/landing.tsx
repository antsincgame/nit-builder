/**
 * Landing page (/about) — v3.1.
 * Новые секции: TunnelSection + FreeForeverSection (фокус на USP).
 * Порядок: Nav → Hero → Tunnel → Templates → How → FreeForever → Comparison → CTA → Footer.
 */

import { useAuth } from "~/lib/contexts/AuthContext";
import { LandingNav } from "~/components/landing/LandingNav";
import { HeroSection } from "~/components/landing/HeroSection";
import { TunnelSection } from "~/components/landing/TunnelSection";
import { TemplatesSection } from "~/components/landing/TemplatesSection";
import { HowItWorksSection } from "~/components/landing/HowItWorksSection";
import { FreeForeverSection } from "~/components/landing/FreeForeverSection";
import { ComparisonSection } from "~/components/landing/ComparisonSection";
import { CtaSection } from "~/components/landing/CtaSection";
import { LandingFooter } from "~/components/landing/LandingFooter";

export function meta() {
  return [
    { title: "NITGEN — AI конструктор сайтов на твоём GPU · бесплатно навсегда" },
    {
      name: "description",
      content:
        "Опиши сайт — получи HTML из своего GPU через p2p-туннель. Никакого облака, никаких лимитов. Open source MIT.",
    },
  ];
}

export default function Landing() {
  const auth = useAuth();
  const isAuthed = auth.status === "authenticated";

  return (
    <div className="relative min-h-screen overflow-x-hidden text-[color:var(--ink)]">
      <LandingNav isAuthed={isAuthed} />
      <main className="relative z-10">
        <HeroSection isAuthed={isAuthed} />
        <TunnelSection />
        <TemplatesSection />
        <HowItWorksSection />
        <FreeForeverSection isAuthed={isAuthed} />
        <ComparisonSection />
        <CtaSection isAuthed={isAuthed} />
      </main>
      <LandingFooter />
    </div>
  );
}

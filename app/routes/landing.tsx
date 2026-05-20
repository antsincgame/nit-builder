/**
 * Landing page (/about) — v3.2 alive-but-clear.
 * Добавлен global ambient layer: dotted grid + animated mesh gradient.
 * Каждая секция получает свой цветовой tint.
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
      {/* Global ambient — mesh gradient + dotted grid */}
      <div className="nit-bg-mesh" aria-hidden>
        <div className="nit-bg-mesh-orb nit-bg-mesh-1" />
        <div className="nit-bg-mesh-orb nit-bg-mesh-2" />
        <div className="nit-bg-mesh-orb nit-bg-mesh-3" />
        <div className="nit-bg-mesh-orb nit-bg-mesh-4" />
      </div>
      <div className="nit-bg-grid" aria-hidden />

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

/**
 * Landing page (/about) — v3 minimal mono à la bolt.new.
 *
 * Концепция: чёрный фон, белый текст, один акцент, без неона и глитча.
 * Hero — промпт-инпут по образцу bolt.new. Режем с 11 секций до 5.
 *
 * Старые секции (ProblemSection, HardwareSection, TechStackSection, FaqSection,
 * TimelineSection, FeaturesSection) остаются в файлах для возможного отката,
 * но больше не импортируются.
 */

import { useAuth } from "~/lib/contexts/AuthContext";
import { LandingNav } from "~/components/landing/LandingNav";
import { HeroSection } from "~/components/landing/HeroSection";
import { TemplatesSection } from "~/components/landing/TemplatesSection";
import { HowItWorksSection } from "~/components/landing/HowItWorksSection";
import { ComparisonSection } from "~/components/landing/ComparisonSection";
import { CtaSection } from "~/components/landing/CtaSection";
import { LandingFooter } from "~/components/landing/LandingFooter";

export function meta() {
  return [
    { title: "NITGEN — AI конструктор сайтов на твоём GPU" },
    {
      name: "description",
      content:
        "Опиши сайт — получи HTML из своего GPU. Без облака, без лимитов. Open source.",
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
        <TemplatesSection />
        <HowItWorksSection />
        <ComparisonSection />
        <CtaSection isAuthed={isAuthed} />
      </main>
      <LandingFooter />
    </div>
  );
}

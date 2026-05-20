/**
 * Landing page — v4 «prostoy» версия.
 *
 * Переориентировано на нетехнических пользователей.
 * Чат/инпут убран, технические секции (Tunnel, Comparison, FreeForever) убраны.
 * Язык: никаких GPU/LLM/p2p/MIT — только «ваш компьютер», «приватно», «бесплатно».
 */

import { useAuth } from "~/lib/contexts/AuthContext";
import { LandingNav } from "~/components/landing/LandingNav";
import { HeroSection } from "~/components/landing/HeroSection";
import { WhySection } from "~/components/landing/WhySection";
import { TemplatesSection } from "~/components/landing/TemplatesSection";
import { HowItWorksSection } from "~/components/landing/HowItWorksSection";
import { CtaSection } from "~/components/landing/CtaSection";
import { LandingFooter } from "~/components/landing/LandingFooter";

export function meta() {
  return [
    { title: "NITGEN — Создавай сайты бесплатно" },
    {
      name: "description",
      content:
        "Опиши свой сайт словами — получи готовый результат за минуту. Без программирования, без подписок.",
    },
  ];
}

export default function Landing() {
  const auth = useAuth();
  const isAuthed = auth.status === "authenticated";

  return (
    <div className="relative min-h-screen overflow-x-hidden text-[color:var(--ink)]">
      {/* Global ambient — мягкий mesh и сетка в фоне */}
      <div className="nit-bg-mesh" aria-hidden>
        <div className="nit-bg-mesh-orb nit-bg-mesh-1" />
        <div className="nit-bg-mesh-orb nit-bg-mesh-2" />
        <div className="nit-bg-mesh-orb nit-bg-mesh-3" />
      </div>
      <div className="nit-bg-grid" aria-hidden />

      <LandingNav isAuthed={isAuthed} />
      <main className="relative z-10">
        <HeroSection isAuthed={isAuthed} />
        <WhySection />
        <TemplatesSection />
        <HowItWorksSection />
        <CtaSection isAuthed={isAuthed} />
      </main>
      <LandingFooter />
    </div>
  );
}

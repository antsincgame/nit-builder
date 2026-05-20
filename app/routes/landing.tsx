/**
 * Landing page (/about). Композирует секции из app/components/landing/.
 *
 * v2.2: убраны HorizontalParticles и сокращены вертикальные Particles
 * (с 35 до 14) — фидбек по визуальному шуму. Оставлены только
 * ConicRays + GridBg + Orbs + Beams — три слоя вместо пяти.
 */

import { useAuth } from "~/lib/contexts/AuthContext";
import {
  Beams,
  ConicRays,
  GridBg,
  Marquee,
  Orbs,
  Particles,
} from "~/components/nit";
import { LandingNav } from "~/components/landing/LandingNav";
import { HeroSection } from "~/components/landing/HeroSection";
import { ProblemSection } from "~/components/landing/ProblemSection";
import { ComparisonSection } from "~/components/landing/ComparisonSection";
import { HowItWorksSection } from "~/components/landing/HowItWorksSection";
import { HardwareSection } from "~/components/landing/HardwareSection";
import { FeaturesSection } from "~/components/landing/FeaturesSection";
import { TechStackSection } from "~/components/landing/TechStackSection";
import { FaqSection } from "~/components/landing/FaqSection";
import { TimelineSection } from "~/components/landing/TimelineSection";
import { CtaSection } from "~/components/landing/CtaSection";
import { LandingFooter } from "~/components/landing/LandingFooter";

export function meta() {
  return [
    { title: "NITGEN // AI sites on your own GPU" },
    {
      name: "description",
      content:
        "AI-конструктор сайтов, работающий на твоём GPU через peer-to-peer туннель. Никакого облака, никаких подписок, только локальные LLM. Open source.",
    },
  ];
}

export default function Landing() {
  const auth = useAuth();
  const isAuthed = auth.status === "authenticated";

  return (
    <div className="relative min-h-screen overflow-x-hidden text-[color:var(--ink)] nit-grain">
      {/* Background-эффекты — fixed-positioned. Сокращено до 4 слоёв
          (было 6): убраны HorizontalParticles, Particles 35→14. */}
      <ConicRays />
      <GridBg />
      <Orbs />
      <Beams />
      <Particles count={14} />

      <LandingNav isAuthed={isAuthed} />
      <HeroSection isAuthed={isAuthed} />

      <Marquee
        items={[
          { text: "YOUR GPU" },
          { text: "YOUR CODE", variant: "outline" },
          { text: "✦", variant: "star" },
          { text: "NO CLOUD" },
          { text: "NO LIMITS", variant: "outline" },
          { text: "✦", variant: "star" },
          { text: "OPEN SOURCE" },
          { text: "ZERO BULLSHIT", variant: "outline" },
          { text: "✦", variant: "star" },
        ]}
      />

      <ProblemSection />
      <ComparisonSection />
      <HowItWorksSection />
      <HardwareSection />
      <FeaturesSection />
      <TechStackSection />
      <FaqSection />
      <TimelineSection />
      <CtaSection isAuthed={isAuthed} />
      <LandingFooter />
    </div>
  );
}

/**
 * Лендинг nitgen — новый дизайн (минимал-нуар + emerald) из nitgen-gront.
 * Заменяет предыдущий cyberpunk-редизайн.
 *
 * Структура (порядок секций как в src/App.tsx исходника):
 *   NeuralBackground (canvas-фон) → Nav → Hero → HowItWorks → Features →
 *   SeoBlock → Comparison → UseCases → FAQ → FinalCTA → Footer
 */
import type { Route } from "./+types/landing";
import NeuralBackground from "~/components/landing/NeuralBackground";
import Nav from "~/components/landing/Nav";
import Hero from "~/components/landing/Hero";
import HowItWorks from "~/components/landing/HowItWorks";
import Features from "~/components/landing/Features";
import SeoBlock from "~/components/landing/SeoBlock";
import Comparison from "~/components/landing/Comparison";
import UseCases from "~/components/landing/UseCases";
import FAQ from "~/components/landing/FAQ";
import FinalCTA from "~/components/landing/FinalCTA";
import Footer from "~/components/landing/Footer";

export const meta: Route.MetaFunction = () => [
  { title: "NITGEN — Создавайте сайты бесплатно с помощью ИИ" },
  {
    name: "description",
    content:
      "Бесплатный генератор сайтов на нейросети. Опишите проект — ИИ соберёт готовый сайт за 60 секунд прямо на вашем компьютере. Без облака, без подписок, без знания кода.",
  },
  {
    name: "keywords",
    content:
      "создать сайт через ИИ, бесплатный генератор сайтов, нейросеть для сайтов, ИИ конструктор, сделать сайт бесплатно",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans relative">
      <NeuralBackground />
      <div className="relative z-10">
        <Nav />
        <main>
          <Hero />
          <HowItWorks />
          <Features />
          <SeoBlock />
          <Comparison />
          <UseCases />
          <FAQ />
          <FinalCTA />
        </main>
        <Footer />
      </div>
    </div>
  );
}

/**
 * Nav — фиксированная навигация лендинга nitgen.
 * Поведение скролла берёт реальный window — в useEffect (SSR-safe).
 * Войти ведёт на /login. Скачать — на якорь #download внутри Hero.
 */
import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Link } from "react-router";
import Logo from "./Logo";

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[#0A0A0A]/95 backdrop-blur-md border-b border-white/[0.06]"
          : "bg-transparent"
      }`}
    >
      <nav className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <Logo size={32} />
          <span className="font-semibold text-[15px] text-white tracking-tight">nitgen</span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-[13px] text-[#71717A] hover:text-white transition-colors">Возможности</a>
          <a href="#how-it-works" className="text-[13px] text-[#71717A] hover:text-white transition-colors">Как работает</a>
          <a href="#comparison" className="text-[13px] text-[#71717A] hover:text-white transition-colors">Сравнение</a>
          <a href="#faq" className="text-[13px] text-[#71717A] hover:text-white transition-colors">FAQ</a>
        </div>

        <div className="hidden md:flex items-center gap-4">
          <Link to="/login" className="text-[13px] text-[#71717A] hover:text-white transition-colors">Войти</Link>
          <a
            href="#download"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-[#0A0A0A] text-[13px] font-medium hover:bg-white/90 transition-colors"
          >
            <Download size={14} />
            Скачать бесплатно
          </a>
        </div>

        <button
          className="md:hidden p-2 text-[#71717A] hover:text-white"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Меню"
        >
          <div className="w-5 flex flex-col gap-1.5">
            <span className={`block h-px bg-current transition-all ${mobileOpen ? "rotate-45 translate-y-[4px]" : ""}`} />
            <span className={`block h-px bg-current transition-all ${mobileOpen ? "opacity-0" : ""}`} />
            <span className={`block h-px bg-current transition-all ${mobileOpen ? "-rotate-45 -translate-y-[4px]" : ""}`} />
          </div>
        </button>
      </nav>

      {mobileOpen && (
        <div className="md:hidden bg-[#0A0A0A]/98 backdrop-blur-md border-b border-white/[0.06] px-5 pb-5 pt-2 flex flex-col gap-4">
          <a href="#features" className="text-sm text-[#71717A]" onClick={() => setMobileOpen(false)}>Возможности</a>
          <a href="#how-it-works" className="text-sm text-[#71717A]" onClick={() => setMobileOpen(false)}>Как работает</a>
          <a href="#comparison" className="text-sm text-[#71717A]" onClick={() => setMobileOpen(false)}>Сравнение</a>
          <a href="#faq" className="text-sm text-[#71717A]" onClick={() => setMobileOpen(false)}>FAQ</a>
          <Link to="/login" className="text-sm text-[#71717A]" onClick={() => setMobileOpen(false)}>Войти</Link>
          <a
            href="#download"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white text-[#0A0A0A] text-sm font-medium"
            onClick={() => setMobileOpen(false)}
          >
            <Download size={14} />
            Скачать бесплатно
          </a>
        </div>
      )}
    </header>
  );
}

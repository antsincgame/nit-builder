import { Link } from "react-router";
import { Instagram, GraduationCap } from "lucide-react";
import Logo from "./Logo";

export default function Footer() {
  return (
    <footer className="border-t border-white/[0.06] py-12">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <Logo size={26} />
            <span className="font-semibold text-sm text-white">nitgen</span>
            <span className="text-xs text-[#71717A] ml-2">Бесплатный ИИ генератор сайтов</span>
          </div>

          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            <Link to="/guide" className="text-[13px] text-[#71717A] hover:text-white transition-colors">Как начать</Link>
            <Link to="/login" className="text-[13px] text-[#71717A] hover:text-white transition-colors">Войти</Link>
            <a href="mailto:support@nitgen.org" className="text-[13px] text-[#71717A] hover:text-white transition-colors">Поддержка</a>
            <Link to="/privacy" className="text-[13px] text-[#71717A] hover:text-white transition-colors">Приватность</Link>
            <Link to="/terms" className="text-[13px] text-[#71717A] hover:text-white transition-colors">Соглашение</Link>
          </div>
        </div>

        {/* Соцсети / школа автора */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
          <a
            href="https://www.instagram.com/dzmitry_arlou"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-white/[0.08] bg-[#141414] text-[13px] text-[#A1A1AA] hover:text-white hover:border-white/[0.15] transition-all"
          >
            <Instagram size={15} className="text-emerald-400/80" />
            Instagram
          </a>
          <a
            href="https://vibecoding.by"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] text-[13px] text-emerald-300 hover:bg-emerald-500/[0.12] hover:border-emerald-500/35 transition-all"
          >
            <GraduationCap size={15} />
            Школа вайбкодинга
          </a>
        </div>

        <div className="mt-8 pt-6 border-t border-white/[0.04]">
          <p className="text-center text-xs text-[#71717A]/50 leading-relaxed max-w-2xl mx-auto">
            nitgen.org — бесплатное создание сайтов через искусственный интеллект.
            Генератор сайтов на нейросети, который работает локально на вашем компьютере.
            Сделать сайт через ИИ бесплатно, без подписок, без облака.
          </p>
          <p className="text-center text-xs text-[#71717A]/30 mt-3">
            © {new Date().getFullYear()} nitgen.org · Сделано в{" "}
            <a
              href="https://vibecoding.by"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#71717A]/50 hover:text-emerald-300/70 transition-colors"
            >
              Школе вайбкодинга
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}

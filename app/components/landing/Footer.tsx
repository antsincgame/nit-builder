import { Link } from "react-router";
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
            <Link to="/login" className="text-[13px] text-[#71717A] hover:text-white transition-colors">Войти</Link>
            <a href="mailto:support@nitgen.org" className="text-[13px] text-[#71717A] hover:text-white transition-colors">Поддержка</a>
            <Link to="/privacy" className="text-[13px] text-[#71717A] hover:text-white transition-colors">Приватность</Link>
            <Link to="/terms" className="text-[13px] text-[#71717A] hover:text-white transition-colors">Соглашение</Link>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-white/[0.04]">
          <p className="text-center text-xs text-[#71717A]/50 leading-relaxed max-w-2xl mx-auto">
            nitgen.org — бесплатное создание сайтов через искусственный интеллект.
            Генератор сайтов на нейросети, который работает локально на вашем компьютере.
            Сделать сайт через ИИ бесплатно, без подписок, без облака.
          </p>
          <p className="text-center text-xs text-[#71717A]/30 mt-3">
            © {new Date().getFullYear()} nitgen.org
          </p>
        </div>
      </div>
    </footer>
  );
}

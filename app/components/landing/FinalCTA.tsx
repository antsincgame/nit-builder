import { Download, ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { useOS } from "~/hooks/useOS";

const osLabels: Record<string, string> = {
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
  unknown: "Windows",
};

export default function FinalCTA() {
  const os = useOS();
  const label = osLabels[os] || "Windows";

  return (
    <section className="py-32">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="relative rounded-3xl border border-emerald-500/20 bg-[#0f1a14] p-12 sm:p-16 text-center overflow-hidden shadow-[0_0_80px_rgba(16,185,129,0.06)]">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 bg-emerald-500/[0.06] rounded-full blur-3xl pointer-events-none" />

          <h2 className="relative text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white mb-4 leading-tight">
            Создайте свой первый сайт<br />
            <span className="bg-gradient-to-r from-emerald-300 via-white to-emerald-200 bg-clip-text text-transparent">через ИИ — для себя</span>
          </h2>
          <p className="relative text-lg text-[#A1A1AA] mb-10 max-w-xl mx-auto">
            <strong className="text-white">Бесплатно для личного использования.</strong> Без карты, без подписки.
            Нейросеть соберёт полноценный сайт — с SEO, картинками, базой и админкой — за <strong className="text-emerald-300">60 секунд</strong>.
          </p>

          <div className="relative flex flex-col items-center gap-3">
            <Link
              to="/download"
              className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#0A0A0A] text-[15px] font-bold transition-all duration-200 shadow-[0_0_30px_rgba(16,185,129,0.4)] hover:shadow-[0_0_40px_rgba(16,185,129,0.6)]"
            >
              <Download size={17} />
              Скачать для {label}
            </Link>
            <Link
              to="/download"
              className="text-sm text-[#71717A] hover:text-emerald-300 transition-colors flex items-center gap-1.5"
            >
              Другие платформы
              <ArrowRight size={13} />
            </Link>
          </div>

          <p className="relative mt-8 text-xs text-[#71717A]/60">
            Бесплатно для личного использования · Регистрация в один клик · ~80 МБ
          </p>
          <p className="relative mt-2 text-xs text-[#71717A]/40">
            Для коммерческого использования требуется лицензия —{" "}
            <a href="mailto:sales@nitgen.org" className="text-emerald-400/50 hover:text-emerald-300/70 underline transition-colors">sales@nitgen.org</a>
          </p>
        </div>
      </div>
    </section>
  );
}

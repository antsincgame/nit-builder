import { useEffect, useRef } from "react";
import { Check, X, Minus } from "lucide-react";

type Val = "yes" | "no" | "partial" | string;

const rows: { label: string; nitgen: Val; tilda: Val; wix: Val; bolt: Val }[] = [
  { label: "Цена", nitgen: "Бесплатно", tilda: "от ₽750/мес", wix: "от $17/мес", bolt: "от $20/мес" },
  { label: "Подписка", nitgen: "no", tilda: "yes", wix: "yes", bolt: "yes" },
  { label: "Лимиты страниц", nitgen: "no", tilda: "partial", wix: "partial", bolt: "partial" },
  { label: "Данные в облаке", nitgen: "no", tilda: "yes", wix: "yes", bolt: "yes" },
  { label: "Работает офлайн", nitgen: "yes", tilda: "no", wix: "no", bolt: "no" },
  { label: "Открытый код", nitgen: "yes", tilda: "no", wix: "no", bolt: "no" },
  { label: "Создание через ИИ", nitgen: "yes", tilda: "no", wix: "partial", bolt: "yes" },
];

function CellValue({ val, isNitgen }: { val: Val; isNitgen?: boolean }) {
  if (val === "yes" || (val === "no" && isNitgen)) {
    const isGood = val === "yes" || isNitgen;
    return (
      <div className="flex justify-center">
        {isGood ? <Check size={15} className="text-emerald-500" /> : <X size={15} className="text-[#71717A]/40" />}
      </div>
    );
  }
  if (val === "no") return <div className="flex justify-center"><X size={15} className="text-[#71717A]/40" /></div>;
  if (val === "partial") return <div className="flex justify-center"><Minus size={15} className="text-[#71717A]/60" /></div>;
  return <div className={`text-center text-sm ${isNitgen ? "text-white font-medium" : "text-[#71717A]"}`}>{val}</div>;
}

export default function Comparison() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("visible"); }),
      { threshold: 0.05 }
    );
    el.querySelectorAll(".fade-in-up").forEach((e) => observer.observe(e));
    return () => observer.disconnect();
  }, []);

  return (
    <section id="comparison" ref={ref} className="py-24">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="text-center mb-14 fade-in-up">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-4">
            Бесплатный ИИ конструктор vs платные сервисы
          </h2>
          <p className="text-[#71717A] text-lg max-w-2xl mx-auto">
            Сравните nitgen с Tilda, Wix и Bolt.new. Бесплатно для личного использования —
            для коммерческих проектов требуется лицензия.
          </p>
        </div>

        <div className="fade-in-up overflow-x-auto -mx-5 sm:mx-0">
          <div className="min-w-[600px] px-5 sm:px-0">
            <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
              <div className="grid grid-cols-5 bg-[#141414]">
                <div className="px-5 py-4 text-[13px] font-medium text-[#71717A]">Параметр</div>
                {["nitgen", "Tilda", "Wix", "Bolt.new"].map((name, i) => (
                  <div key={name} className={`px-4 py-4 text-center text-[13px] font-semibold ${i === 0 ? "text-emerald-300" : "text-[#71717A]"}`}>
                    {name}
                  </div>
                ))}
              </div>

              {rows.map((row, i) => {
                const isNitgenGood = row.nitgen === "yes" || (row.nitgen === "no" && ["Подписка", "Лимиты страниц", "Данные в облаке"].includes(row.label));
                const isPriceRow = row.label === "Цена";
                return (
                  <div key={row.label} className={`grid grid-cols-5 border-t border-white/[0.04] ${isPriceRow ? "bg-emerald-500/[0.04]" : i % 2 === 0 ? "" : "bg-white/[0.01]"}`}>
                    <div className={`px-5 py-3.5 text-[13px] ${isPriceRow ? "text-white font-medium" : "text-[#A1A1AA]"}`}>{row.label}</div>
                    <div className={`px-4 py-3.5 ${isNitgenGood ? "bg-emerald-500/[0.04]" : ""}`}>
                      {isPriceRow ? (
                        <div className="text-center text-[13px] text-emerald-400 font-bold">{row.nitgen}</div>
                      ) : row.label === "Подписка" || row.label === "Лимиты страниц" || row.label === "Данные в облаке" ? (
                        <div className="flex justify-center"><Check size={15} className="text-emerald-400" /></div>
                      ) : (
                        <CellValue val={row.nitgen} isNitgen />
                      )}
                    </div>
                    {(["tilda", "wix", "bolt"] as const).map((key) => (
                      <div key={key} className="px-4 py-3.5">
                        <CellValue val={row[key]} />
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-10 fade-in-up">
          <p className="text-center text-sm text-[#71717A] max-w-2xl mx-auto leading-relaxed">
            В отличие от платных конструкторов, nitgen бесплатен для личного использования без ежемесячных платежей.
            AI-генератор работает на вашем ПК — данные не уходят в облако.{" "}
            Для коммерческого использования — <a href="mailto:sales@nitgen.org" className="text-emerald-400/70 hover:text-emerald-300 underline transition-colors">запросить лицензию</a>.
          </p>
        </div>
      </div>
    </section>
  );
}

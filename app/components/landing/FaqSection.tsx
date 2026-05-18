/**
 * FaqSection — секция "07 · FAQ".
 *
 * 8 типичных возражений и ответы на них. Принцип: бить точно по тем
 * вопросам которые юзер задаст сам себе на этом этапе скролла (после
 * comparison + hardware + tech stack). Не риторические вопросы, а
 * настоящие сомнения:
 *  - "стоит ли тратить $$ на GPU?"
 *  - "что если NITGEN VPS упадёт?"
 *  - "почему не использовать ChatGPT напрямую?"
 *  - "локальная модель = хуже качество?"
 *
 * Реализация: accordion с native <details> — никаких JS-state, работает
 * без hydration, доступно для скринридеров. Acid-цвет на ► маркере при
 * раскрытии.
 */

import { RevealOnScroll, SectionLabel } from "~/components/nit";

type Faq = {
  q: string;
  a: string;
};

const FAQS: Faq[] = [
  {
    q: "У меня нет мощного GPU. Что мне делать?",
    a: "Минимум — 4 ГБ VRAM (RTX 3050 или старее). Если совсем нет — Mac на M1/M2/M3/M4 работают через unified memory без выделенного GPU. Если ни того, ни другого — взять б/у RTX 3060 8GB на Avito за ~15k ₽ окупается за 1.5 месяца использования v0/Bolt. Через год это твоё железо, не аренда.",

  },
  {
    q: "А если ваш VPS упадёт? Я потеряю доступ?",
    a: "Нет. Сервер — тонкая прокладка для маршрутизации (340 строк, без LLM-логики). Если мы закрываемся — клонируешь репо, запускаешь `docker compose up` на своём сервере или VPS за $5/мес, продолжаешь работать. Это значит без vendor lock-in принципиально.",
  },
  {
    q: "Почему не пользоваться ChatGPT / Claude напрямую?",
    a: "Можно. Но они дают тебе чат с текстом, а не интегрированный workflow: live-preview, polish через структурированные правки, 22 шаблона как стартовая точка, export в HTML/PHP-CMS. Плюс цензура и логирование промптов остаются — это всё та же боль что у v0/Bolt.",
  },
  {
    q: "Локальная Qwen2.5-Coder-7B — это же хуже GPT-4?",
    a: "Для общего чата — да, GPT-4 / Claude шире. Для генерации шаблонной landing page — нет. Coder-модели обучены конкретно на коде, и работа сводится к адаптации проверенного HTML-шаблона под твой промпт. Маленькая специализированная модель тут зачастую дает результат лучше большой общей.",
  },
  {
    q: "Сколько весит модель? Долго качать?",
    a: "Qwen2.5-Coder-7B Q4_K_M = 4.5 GB. На обычном домашнем интернете 50-100 Мбит/с — 5-10 минут. Качается один раз через LM Studio, потом живёт локально. Никаких подписок на обновления, никаких principal-component версий.",
  },
  {
    q: "Можно ли пользоваться без своего GPU — через общий пул?",
    a: "Пока нет. Это в roadmap (v3.0+) — концепт «один член команды держит туннель, остальные используют через расшаренный токен». Сейчас 1 туннель = 1 пользователь. Но архитектурно мы готовы — `tunnelRegistry` уже поддерживает multi-tab browser на один tunnel.",
  },
  {
    q: "Что насчёт коммерческого использования?",
    a: "Лицензия MIT — делай что хочешь, включая продажу сгенерированных сайтов клиентам. У нас тоже так — Igor использует NITGEN в фриланс-практике, генерирует сайты для клиентов из Беларуси/России/Финляндии. Никаких роялти, никаких 'powered by' в footer'е (только если сам захочешь).",
  },
  {
    q: "Чем вы отличаетесь от self-hosted Bolt / OpenWebUI?",
    a: "Они дают тебе общий чат с LLM. Мы — узкоспециализированный editor для генерации HTML-сайтов с pipeline'ом Planner→Coder→Polisher, RAG-поиском по 22 шаблонам, polished UX вокруг этого. Self-hosted Bolt всё ещё качает токены из cloud API. У нас всё на твоём GPU.",
  },
];

export function FaqSection() {
  return (
    <section id="faq" className="relative z-10 max-w-[900px] mx-auto px-8 py-32">
      <RevealOnScroll>
        <SectionLabel number="07">FAQ</SectionLabel>
      </RevealOnScroll>
      <RevealOnScroll>
        <h2 className="nit-display text-[clamp(36px,5vw,72px)] mb-6">
          Вопросы что{" "}
          <em
            className="not-italic"
            style={{ color: "transparent", WebkitTextStroke: "1.5px var(--magenta)" }}
          >
            бьют первыми
          </em>
        </h2>
      </RevealOnScroll>
      <RevealOnScroll delay={100}>
        <p className="text-[14px] text-[color:var(--muted)] leading-[1.7] mb-12 max-w-[700px]">
          Не маркетинговый FAQ из 30 пунктов «как мы хороши». Это то что
          юзер реально спрашивает на 3-й минуте скролла. Если твой вопрос
          не здесь — открой issue в GitHub.
        </p>
      </RevealOnScroll>

      <div className="flex flex-col gap-2">
        {FAQS.map((f, i) => (
          <RevealOnScroll key={f.q} delay={i * 50}>
            <FaqItem {...f} />
          </RevealOnScroll>
        ))}
      </div>
    </section>
  );
}

function FaqItem({ q, a }: Faq) {
  return (
    <details
      className="group nit-faq"
      style={{
        border: "1px solid var(--line)",
        background: "var(--bg)",
      }}
    >
      <summary
        className="flex items-center justify-between gap-4 p-5 cursor-pointer list-none transition-colors hover:bg-[rgba(157,77,255,0.04)]"
        style={{ outline: "none" }}
      >
        <span className="nit-display text-[16px] leading-[1.4] flex-1">
          {q}
        </span>
        <span
          className="text-[18px] transition-transform duration-300 group-open:rotate-90 group-open:text-[color:var(--acid)] shrink-0"
          style={{ color: "var(--accent-glow)", fontFamily: "var(--font-mono)" }}
        >
          ▸
        </span>
      </summary>
      <div
        className="px-5 pb-5 text-[13px] leading-[1.7] text-[color:var(--muted)]"
        style={{ borderTop: "1px solid var(--line)", paddingTop: "16px" }}
      >
        {a}
      </div>
    </details>
  );
}

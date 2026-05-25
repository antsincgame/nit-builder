/**
 * /terms — Пользовательское соглашение nitgen.
 * Адаптировано из src/components/Terms.tsx (Bolt):
 * navigate('/x') из кастомного pushState-роутера → useNavigate() от react-router.
 */
import type { Route } from "./+types/terms";
import { ArrowLeft, Scale, UserCheck, ShieldAlert, Mail, AlertTriangle, Ban } from "lucide-react";
import { useNavigate } from "react-router";

export const meta: Route.MetaFunction = () => [
  { title: "Пользовательское соглашение — nitgen" },
  {
    name: "description",
    content:
      "Условия использования nitgen. Бесплатно для личного использования, отдельная коммерческая лицензия, права на создаваемый контент остаются у пользователя.",
  },
];

function Section({ id, children }: { id: string; children: React.ReactNode }) {
  return <section id={id} className="scroll-mt-8">{children}</section>;
}

function H2({ anchor, children }: { anchor: string; children: React.ReactNode }) {
  return (
    <a href={`#${anchor}`} className="group flex items-center gap-2 no-underline">
      <h2 className="text-base font-bold text-white group-hover:text-emerald-300 transition-colors">{children}</h2>
      <span className="text-[#3f3f46] group-hover:text-emerald-500/50 text-xs opacity-0 group-hover:opacity-100 transition-opacity">#</span>
    </a>
  );
}

function Callout({ icon: Icon, color, children }: { icon: React.ElementType; color: string; children: React.ReactNode }) {
  return (
    <div className={`flex gap-3 rounded-xl border p-4 ${color}`}>
      <Icon size={16} className="shrink-0 mt-0.5" />
      <div className="text-[13px] leading-relaxed">{children}</div>
    </div>
  );
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2 text-[13px] text-[#A1A1AA] leading-relaxed">
      <span className="text-emerald-500/50 mt-1 shrink-0">▸</span>
      <span>{children}</span>
    </li>
  );
}

function BanLi({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2 text-[13px] text-[#A1A1AA] leading-relaxed">
      <span className="text-red-400/50 mt-1 shrink-0">✕</span>
      <span>{children}</span>
    </li>
  );
}

const toc = [
  { id: "subject", label: "Предмет соглашения" },
  { id: "account", label: "Регистрация и аккаунт" },
  { id: "license", label: "Лицензия и права" },
  { id: "allowed", label: "Допустимое использование" },
  { id: "content", label: "Права на созданный контент" },
  { id: "warranty", label: "Отказ от гарантий" },
  { id: "liability", label: "Ограничение ответственности" },
  { id: "termination", label: "Расторжение" },
  { id: "changes", label: "Изменения соглашения" },
  { id: "law", label: "Применимое право" },
  { id: "contact", label: "Контакты" },
];

export default function Terms() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-16">
        <button
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-2 text-sm text-[#71717A] hover:text-white transition-colors mb-10 cursor-pointer"
        >
          <ArrowLeft size={15} />
          На главную
        </button>

        <div className="mb-10 pb-8 border-b border-white/[0.06]">
          <p className="text-[11px] text-[#71717A] uppercase tracking-[0.12em] mb-3 font-medium">Юридический документ</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3 tracking-tight">
            Пользовательское <span className="text-emerald-400">соглашение</span>
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-[#71717A]">
            <span>Последнее обновление: <strong className="text-[#A1A1AA]">22 мая 2026 г.</strong></span>
            <span className="hidden sm:inline text-white/10">·</span>
            <span>Версия: <strong className="text-[#A1A1AA]">1.0</strong></span>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-12">
          <aside className="lg:w-52 shrink-0">
            <div className="lg:sticky lg:top-8">
              <p className="text-[10px] uppercase tracking-[0.1em] text-[#71717A] font-medium mb-3">Содержание</p>
              <nav className="flex flex-col gap-1">
                {toc.map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className="text-[12px] text-[#52525B] hover:text-[#A1A1AA] transition-colors py-0.5 leading-snug"
                  >
                    {item.label}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          <div className="flex-1 space-y-10 min-w-0">
            <Callout icon={Scale} color="border-emerald-500/20 bg-emerald-500/5 text-emerald-300">
              Регистрируясь или используя Сервис, вы подтверждаете, что прочитали и принимаете
              все условия настоящего Соглашения в полном объёме.
            </Callout>

            <Section id="subject">
              <H2 anchor="subject">1. Предмет соглашения</H2>
              <p className="mt-3 text-[13px] text-[#A1A1AA] leading-relaxed">
                Компания <strong className="text-white/80">nitgen</strong> предоставляет доступ к ПО —
                локальному генератору веб-сайтов на основе <strong className="text-white/80">искусственного интеллекта</strong>.
                ПО устанавливается и запускается на вашем устройстве; вся обработка данных происходит
                <strong className="text-white/80"> локально</strong> — без отправки контента в облако.
                Использование ПО регулируется условиями лицензии, описанной в разделе 3.
              </p>
            </Section>

            <Section id="account">
              <H2 anchor="account">2. Регистрация и учётная запись</H2>
              <ul className="mt-3 space-y-2">
                <Li>Для доступа необходима регистрация с <strong className="text-white/70">действующим email-адресом</strong>.</Li>
                <Li>Вы несёте ответственность за <strong className="text-white/70">сохранность учётных данных</strong> и все действия под вашим аккаунтом.</Li>
                <Li>Создание нескольких аккаунтов одним пользователем <strong className="text-white/70">запрещено</strong>.</Li>
                <Li>При несанкционированном доступе к аккаунту — немедленно уведомите нас на{" "}
                  <a href="mailto:security@nitgen.org" className="text-emerald-400 hover:text-emerald-300 transition-colors">security@nitgen.org</a>.
                </Li>
              </ul>
            </Section>

            <Section id="license">
              <H2 anchor="license">3. Лицензия и права</H2>
              <p className="mt-3 mb-4 text-[13px] text-[#A1A1AA]">
                ПО доступно по двум типам лицензий. Выберите подходящую:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <p className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider mb-1">Бесплатная лицензия</p>
                  <p className="text-[11px] text-emerald-300/60 mb-3">Личное некоммерческое использование</p>
                  <ul className="space-y-1.5">
                    <Li>Личные проекты, хобби, обучение</Li>
                    <Li>Некоммерческие сайты (портфолио, блог)</Li>
                    <Li>Установка на собственных устройствах</Li>
                  </ul>
                </div>
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                  <p className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider mb-1">Коммерческая лицензия</p>
                  <p className="text-[11px] text-amber-300/60 mb-3">Требуется для коммерческого использования</p>
                  <ul className="space-y-1.5">
                    <Li>Создание сайтов для клиентов / на продажу</Li>
                    <Li>Использование в рамках бизнеса или агентства</Li>
                    <Li>Внутренние корпоративные проекты</Li>
                  </ul>
                </div>
              </div>

              <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.04] p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1">
                  <p className="text-[12px] font-semibold text-white/80">Нужна коммерческая лицензия?</p>
                  <p className="text-[11px] text-[#71717A] mt-0.5">Свяжитесь с нашим отделом продаж — ответим в течение 1 рабочего дня.</p>
                </div>
                <a
                  href="mailto:sales@nitgen.org"
                  className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500/15 border border-amber-500/25 text-[12px] text-amber-300 hover:bg-amber-500/25 transition-colors font-medium"
                >
                  sales@nitgen.org →
                </a>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <p className="text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-2">В любом случае запрещено</p>
                  <ul className="space-y-1.5">
                    <BanLi>Копировать, перепродавать или сублицензировать само ПО</BanLi>
                    <BanLi>Реверс-инжиниринг и декомпиляция</BanLi>
                    <BanLi>Создавать на основе ПО конкурирующий продукт</BanLi>
                  </ul>
                </div>
                <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/[0.03] p-4">
                  <p className="text-[11px] font-semibold text-emerald-400/60 uppercase tracking-wider mb-2">Права на созданный контент</p>
                  <ul className="space-y-1.5">
                    <Li>Сайты, созданные через nitgen — <strong className="text-white/70">ваша собственность</strong></Li>
                    <Li>Мы не претендуем на права на генерируемый контент</Li>
                  </ul>
                </div>
              </div>
            </Section>

            <Section id="allowed">
              <H2 anchor="allowed">4. Допустимое использование</H2>
              <p className="mt-3 mb-2 text-[13px] text-[#A1A1AA]">Сервис <strong className="text-white/70">нельзя использовать</strong> для:</p>
              <ul className="space-y-2">
                <BanLi>Создания контента, нарушающего законодательство или права третьих лиц.</BanLi>
                <BanLi>Распространения вредоносного ПО, спама, фишинга.</BanLi>
                <BanLi>Любых действий, наносящих ущерб инфраструктуре Сервиса.</BanLi>
              </ul>
              <Callout icon={ShieldAlert} color="border-amber-500/20 bg-amber-500/5 text-amber-200/80 mt-3">
                Нарушение этих условий влечёт <strong>немедленную блокировку аккаунта</strong> без предварительного уведомления.
              </Callout>
            </Section>

            <Section id="content">
              <H2 anchor="content">5. Права на созданный контент</H2>
              <div className="mt-3 space-y-2 text-[13px] text-[#A1A1AA] leading-relaxed">
                <Callout icon={UserCheck} color="border-emerald-500/20 bg-emerald-500/5 text-emerald-300">
                  <strong>Всё, что вы создаёте — ваше.</strong> Сайты и материалы, созданные с помощью nitgen,
                  являются вашей собственностью. Мы не претендуем на права на ваш контент.
                </Callout>
                <p className="pt-1">
                  Вы самостоятельно несёте ответственность за соответствие созданного контента
                  законодательству и соблюдение прав интеллектуальной собственности третьих лиц.
                </p>
              </div>
            </Section>

            <Section id="warranty">
              <H2 anchor="warranty">6. Отказ от гарантий</H2>
              <p className="mt-3 text-[13px] text-[#A1A1AA] leading-relaxed">
                Сервис предоставляется <strong className="text-white/80">«как есть» (as is)</strong> без гарантий
                пригодности для конкретных целей, бесперебойной работы или отсутствия ошибок.
                Мы не гарантируем доступность Сервиса в любое время.
              </p>
            </Section>

            <Section id="liability">
              <H2 anchor="liability">7. Ограничение ответственности</H2>
              <Callout icon={Ban} color="border-white/[0.06] bg-white/[0.02] text-[#A1A1AA]">
                В максимальной степени, допустимой законодательством, Компания не несёт ответственности
                за <strong className="text-white">косвенные, случайные или штрафные убытки</strong>,
                включая потерю данных или упущенную выгоду.
              </Callout>
            </Section>

            <Section id="termination">
              <H2 anchor="termination">8. Расторжение</H2>
              <ul className="mt-3 space-y-2">
                <Li><strong className="text-white/70">Вы</strong> вправе расторгнуть Соглашение в любое время, удалив аккаунт.</Li>
                <Li><strong className="text-white/70">Компания</strong> вправе приостановить аккаунт при нарушении условий Соглашения.</Li>
              </ul>
            </Section>

            <Section id="changes">
              <H2 anchor="changes">9. Изменения соглашения</H2>
              <Callout icon={AlertTriangle} color="border-amber-500/20 bg-amber-500/5 text-amber-200/80">
                Существенные изменения вступают в силу через <strong>14 дней</strong> после уведомления на email.
                Продолжение использования Сервиса означает согласие с новыми условиями.
              </Callout>
            </Section>

            <Section id="law">
              <H2 anchor="law">10. Применимое право</H2>
              <p className="mt-3 text-[13px] text-[#A1A1AA] leading-relaxed">
                Соглашение регулируется <strong className="text-white/80">законодательством Российской Федерации</strong>.
                Споры разрешаются в судебном порядке по месту нахождения Компании,
                если иное не предусмотрено законодательством о защите прав потребителей.
              </p>
            </Section>

            <Section id="contact">
              <H2 anchor="contact">11. Контакты</H2>
              <div className="mt-3 flex items-center gap-3 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <Mail size={16} className="text-emerald-400/70 shrink-0" />
                <div>
                  <p className="text-[12px] text-[#71717A]">Юридические вопросы</p>
                  <a href="mailto:legal@nitgen.org" className="text-[13px] text-emerald-400 hover:text-emerald-300 transition-colors font-medium">
                    legal@nitgen.org
                  </a>
                </div>
              </div>
            </Section>

            <div className="pt-8 border-t border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-white via-white/95 to-white/80 flex items-center justify-center">
                  <span className="text-[#0A0A0A] font-bold text-[10px]">N</span>
                </div>
                <span className="font-semibold text-sm text-white">nitgen</span>
                <span className="text-xs text-[#71717A] ml-1">© {new Date().getFullYear()}</span>
              </div>
              <button
                onClick={() => navigate("/privacy")}
                className="text-[12px] text-[#71717A] hover:text-white transition-colors underline cursor-pointer"
              >
                Политика конфиденциальности
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

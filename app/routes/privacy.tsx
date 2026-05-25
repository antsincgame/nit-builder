/**
 * /privacy — Политика конфиденциальности nitgen.
 * Адаптировано из src/components/PrivacyPolicy.tsx (Bolt):
 * navigate('/x') из кастомного pushState-роутера → useNavigate() от react-router.
 */
import type { Route } from "./+types/privacy";
import { ArrowLeft, ShieldCheck, Eye, Trash2, Mail, FileText, Lock, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router";

export const meta: Route.MetaFunction = () => [
  { title: "Политика конфиденциальности — nitgen" },
  {
    name: "description",
    content:
      "Как nitgen работает с персональными данными. Локальная обработка, минимум собираемых данных, соответствие ФЗ-152 и Закону № 99-З.",
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

const toc = [
  { id: "scope", label: "Предмет и сфера применения" },
  { id: "data", label: "Какие данные мы собираем" },
  { id: "purposes", label: "Цели обработки" },
  { id: "legal", label: "Правовые основания" },
  { id: "storage", label: "Хранение и защита" },
  { id: "rights", label: "Ваши права" },
  { id: "cookies", label: "Cookies" },
  { id: "changes", label: "Изменения Политики" },
  { id: "contact", label: "Контакты" },
];

export default function PrivacyPolicy() {
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
            Политика <span className="text-emerald-400">конфиденциальности</span>
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
            <Callout icon={ShieldCheck} color="border-emerald-500/20 bg-emerald-500/5 text-emerald-300">
              <strong>Коротко о главном:</strong> nitgen работает <strong>полностью локально</strong> на вашем
              устройстве. Содержимое ваших проектов и промптов никогда не покидает ваш компьютер.
              Мы собираем только то, что необходимо для работы аккаунта.
            </Callout>

            <Section id="scope">
              <H2 anchor="scope">1. Предмет и сфера применения</H2>
              <div className="mt-3 space-y-2 text-[13px] text-[#A1A1AA] leading-relaxed">
                <p>
                  Настоящая Политика конфиденциальности описывает, как <strong className="text-white/80">nitgen</strong> (далее — «Оператор», «мы»)
                  собирает, использует и защищает ваши данные при использовании сервиса <strong className="text-white/80">nitgen.org</strong>.
                </p>
                <p>
                  Политика распространяется на пользователей в <strong className="text-white/80">Российской Федерации</strong> (ФЗ-152 «О персональных данных»),
                  <strong className="text-white/80"> Республике Беларусь</strong> (Закон № 99-З «О защите персональных данных») и иных юрисдикциях.
                </p>
              </div>
            </Section>

            <Section id="data">
              <H2 anchor="data">2. Какие данные мы собираем</H2>
              <div className="mt-3 space-y-3">
                <div className="rounded-xl border border-white/[0.06] overflow-hidden">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                        <th className="text-left px-4 py-2.5 text-[#71717A] font-medium">Тип данных</th>
                        <th className="text-left px-4 py-2.5 text-[#71717A] font-medium">Когда собирается</th>
                        <th className="text-left px-4 py-2.5 text-[#71717A] font-medium">Обязательно</th>
                      </tr>
                    </thead>
                    <tbody className="text-[#A1A1AA]">
                      <tr className="border-b border-white/[0.04]">
                        <td className="px-4 py-3 font-medium text-white/80">Email-адрес</td>
                        <td className="px-4 py-3">При регистрации</td>
                        <td className="px-4 py-3"><span className="text-emerald-400">Да</span></td>
                      </tr>
                      <tr className="border-b border-white/[0.04]">
                        <td className="px-4 py-3 font-medium text-white/80">IP-адрес, браузер, ОС</td>
                        <td className="px-4 py-3">Автоматически</td>
                        <td className="px-4 py-3"><span className="text-[#71717A]">Нет</span></td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 font-medium text-white/80">Агрегированная статистика</td>
                        <td className="px-4 py-3">В процессе использования</td>
                        <td className="px-4 py-3"><span className="text-[#71717A]">Нет</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <Callout icon={Lock} color="border-white/[0.06] bg-white/[0.02] text-[#A1A1AA]">
                  Содержимое ваших проектов, промптов и генерируемого кода <strong className="text-white">не собирается и не передаётся</strong> —
                  вся обработка происходит локально на вашем устройстве.
                </Callout>
              </div>
            </Section>

            <Section id="purposes">
              <H2 anchor="purposes">3. Цели обработки</H2>
              <ul className="mt-3 space-y-2">
                <Li>Предоставление доступа к Сервису и <strong className="text-white/70">идентификация пользователя</strong>.</Li>
                <Li>Отправка технических уведомлений и уведомлений об обновлениях.</Li>
                <Li>Улучшение Сервиса на основе <strong className="text-white/70">агрегированной</strong> (обезличенной) статистики.</Li>
                <Li>Исполнение требований законодательства.</Li>
              </ul>
            </Section>

            <Section id="legal">
              <H2 anchor="legal">4. Правовые основания</H2>
              <ul className="mt-3 space-y-2">
                <Li><strong className="text-white/70">Согласие</strong> субъекта (ст. 6 ФЗ-152, ст. 6 Закона № 99-З) — при регистрации.</Li>
                <Li><strong className="text-white/70">Исполнение договора</strong> — для обеспечения работы аккаунта.</Li>
                <Li><strong className="text-white/70">Законный интерес</strong> — для обеспечения безопасности Сервиса.</Li>
              </ul>
            </Section>

            <Section id="storage">
              <H2 anchor="storage">5. Хранение и защита</H2>
              <div className="mt-3 space-y-3 text-[13px] text-[#A1A1AA] leading-relaxed">
                <p>
                  Данные хранятся на серверах, расположенных на территории <strong className="text-white/80">ЕС и/или РФ</strong>.
                  Оператор применяет: шифрование <strong className="text-white/80">TLS</strong> при передаче,
                  ограниченный доступ персонала, регулярный аудит безопасности.
                </p>
                <p>
                  <strong className="text-white/80">Срок хранения</strong> — до момента удаления аккаунта или отзыва согласия,
                  если иное не предусмотрено законодательством.
                </p>
              </div>
            </Section>

            <Section id="rights">
              <H2 anchor="rights">6. Ваши права</H2>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { icon: Eye, title: "Доступ", desc: "Запросить копию своих данных" },
                  { icon: FileText, title: "Исправление", desc: "Потребовать исправления неточных данных" },
                  { icon: Trash2, title: "Удаление", desc: "Право на забвение — полное удаление данных" },
                  { icon: ShieldCheck, title: "Отзыв согласия", desc: "Отозвать согласие на обработку в любой момент" },
                ].map((r) => (
                  <div key={r.title} className="flex gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <r.icon size={14} className="text-emerald-400/70 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[12px] font-semibold text-white/80">{r.title}</p>
                      <p className="text-[11px] text-[#71717A] mt-0.5">{r.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[13px] text-[#A1A1AA]">
                Для реализации прав направьте запрос на{" "}
                <a href="mailto:privacy@nitgen.org" className="text-emerald-400 hover:text-emerald-300 transition-colors font-medium">
                  privacy@nitgen.org
                </a>.{" "}
                Срок ответа — <strong className="text-white/70">30 дней</strong>.
              </p>
            </Section>

            <Section id="cookies">
              <H2 anchor="cookies">7. Cookies</H2>
              <p className="mt-3 text-[13px] text-[#A1A1AA] leading-relaxed">
                Сервис использует <strong className="text-white/80">технические (необходимые) cookie</strong> для работы аутентификации и сессии.
                Аналитические cookie используются только в агрегированном виде и не позволяют идентифицировать вас.
                Вы можете отключить cookie в настройках браузера, однако это может повлиять на функциональность.
              </p>
            </Section>

            <Section id="changes">
              <H2 anchor="changes">8. Изменения Политики</H2>
              <Callout icon={AlertTriangle} color="border-amber-500/20 bg-amber-500/5 text-amber-200/80">
                При <strong>существенных изменениях</strong> мы уведомим вас по электронной почте
                не менее чем за <strong>7 дней</strong> до вступления изменений в силу.
              </Callout>
            </Section>

            <Section id="contact">
              <H2 anchor="contact">9. Контакты</H2>
              <div className="mt-3 flex items-center gap-3 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <Mail size={16} className="text-emerald-400/70 shrink-0" />
                <div>
                  <p className="text-[12px] text-[#71717A]">Вопросы о конфиденциальности</p>
                  <a href="mailto:privacy@nitgen.org" className="text-[13px] text-emerald-400 hover:text-emerald-300 transition-colors font-medium">
                    privacy@nitgen.org
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
                onClick={() => navigate("/terms")}
                className="text-[12px] text-[#71717A] hover:text-white transition-colors underline cursor-pointer"
              >
                Пользовательское соглашение
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

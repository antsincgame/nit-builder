/**
 * TunnelSection v3.2 — + section tint + reveal animations.
 */

import { RevealOnScroll } from "~/components/landing/RevealOnScroll";

export function TunnelSection() {
  return (
    <section className="relative px-5 sm:px-8 py-16 sm:py-24" style={{ borderTop: "1px solid var(--line)" }}>
      <div className="section-tint section-tint-cyan" aria-hidden />
      <div className="relative max-w-[1100px] mx-auto">
        <RevealOnScroll>
          <div className="text-center mb-10 sm:mb-14">
            <div className="text-[12px] tracking-[0.15em] uppercase mb-3" style={{ color: "var(--cyan)" }}>
              P2P tunnel
            </div>
            <h2
              className="nit-display mb-4"
              style={{ fontSize: "clamp(28px, 5vw, 48px)", color: "var(--ink)" }}
            >
              Код крутится
              <br />
              <span className="nit-text-gradient-cyan">на твоём железе</span>
            </h2>
            <p className="text-[14px] sm:text-[16px] max-w-[520px] mx-auto" style={{ color: "var(--muted)" }}>
              Наш сервер — почтальон. LLM работает на твоём GPU,
              промпты никуда не уходят.
            </p>
          </div>
        </RevealOnScroll>

        <RevealOnScroll delay={120}>
          <div className="relative">
            <svg
              viewBox="0 0 1000 280"
              xmlns="http://www.w3.org/2000/svg"
              className="w-full h-auto"
              preserveAspectRatio="xMidYMid meet"
              aria-hidden
            >
              <defs>
                <radialGradient id="node-gpu" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="node-server" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="node-browser" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
                </radialGradient>
                <linearGradient id="line-grad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0" />
                  <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
                </linearGradient>
              </defs>

              <circle cx="130" cy="140" r="130" fill="url(#node-gpu)" />
              <circle cx="500" cy="140" r="110" fill="url(#node-server)" />
              <circle cx="870" cy="140" r="130" fill="url(#node-browser)" />

              <line x1="200" y1="140" x2="440" y2="140" stroke="url(#line-grad)" strokeWidth="2" />
              <line x1="200" y1="140" x2="440" y2="140" className="tunnel-line" />
              <line x1="560" y1="140" x2="800" y2="140" stroke="url(#line-grad)" strokeWidth="2" />
              <line x1="560" y1="140" x2="800" y2="140" className="tunnel-line" />

              <circle r="5" className="tunnel-packet" style={{ offsetPath: "path('M200,140 L440,140')", animation: "nit-flow-right 2.4s linear infinite" }} />
              <circle r="5" className="tunnel-packet" style={{ offsetPath: "path('M200,140 L440,140')", animation: "nit-flow-right 2.4s linear infinite", animationDelay: "0.8s" }} />
              <circle r="5" className="tunnel-packet" style={{ offsetPath: "path('M200,140 L440,140')", animation: "nit-flow-right 2.4s linear infinite", animationDelay: "1.6s" }} />
              <circle r="5" className="tunnel-packet" style={{ offsetPath: "path('M560,140 L800,140')", animation: "nit-flow-right 2.4s linear infinite", animationDelay: "0.4s" }} />
              <circle r="5" className="tunnel-packet" style={{ offsetPath: "path('M560,140 L800,140')", animation: "nit-flow-right 2.4s linear infinite", animationDelay: "1.2s" }} />
              <circle r="5" className="tunnel-packet" style={{ offsetPath: "path('M560,140 L800,140')", animation: "nit-flow-right 2.4s linear infinite", animationDelay: "2.0s" }} />

              <g>
                <rect x="60" y="80" width="140" height="120" rx="14" fill="#13141b" stroke="rgba(56,189,248,0.4)" strokeWidth="1.2" />
                <text x="130" y="118" textAnchor="middle" fill="#fafafa" fontFamily="Inter, sans-serif" fontSize="15" fontWeight="600">Твой GPU</text>
                <text x="130" y="140" textAnchor="middle" fill="#a3a3a3" fontFamily="JetBrains Mono, monospace" fontSize="11">RTX 3060 / 4060</text>
                <text x="130" y="168" textAnchor="middle" fill="#38bdf8" fontFamily="JetBrains Mono, monospace" fontSize="10">qwen2.5-coder-7b</text>
                <circle cx="130" cy="190" r="3" fill="#22c55e">
                  <animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite" />
                </circle>
              </g>

              <g>
                <rect x="440" y="80" width="120" height="120" rx="14" fill="#13141b" stroke="rgba(34,197,94,0.45)" strokeWidth="1.4" />
                <text x="500" y="118" textAnchor="middle" fill="#fafafa" fontFamily="Inter, sans-serif" fontSize="15" fontWeight="600">NITGEN</text>
                <text x="500" y="140" textAnchor="middle" fill="#a3a3a3" fontFamily="JetBrains Mono, monospace" fontSize="11">passthru</text>
                <text x="500" y="168" textAnchor="middle" fill="#22c55e" fontFamily="JetBrains Mono, monospace" fontSize="10">0 байт лога</text>
              </g>

              <g>
                <rect x="800" y="80" width="140" height="120" rx="14" fill="#13141b" stroke="rgba(167,139,250,0.45)" strokeWidth="1.2" />
                <text x="870" y="118" textAnchor="middle" fill="#fafafa" fontFamily="Inter, sans-serif" fontSize="15" fontWeight="600">Браузер</text>
                <text x="870" y="140" textAnchor="middle" fill="#a3a3a3" fontFamily="JetBrains Mono, monospace" fontSize="11">HTML stream</text>
                <text x="870" y="168" textAnchor="middle" fill="#a78bfa" fontFamily="JetBrains Mono, monospace" fontSize="10">live preview</text>
                <circle cx="870" cy="190" r="3" fill="#22c55e">
                  <animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite" begin="0.6s" />
                </circle>
              </g>
            </svg>
          </div>
        </RevealOnScroll>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-10 sm:mt-14">
          {[
            { icon: "🔒", title: "Промпты никуда не уходят", desc: "Сервер видит только зашифрованный трафик между браузером и твоим GPU", color: "var(--cyan)" },
            { icon: "⚡", title: "Офлайн-способный", desc: "Без интернета на сервер — локальный LM Studio работает из коробки", color: "var(--amber)" },
            { icon: "∞", title: "Без лимитов", desc: "Сколько выдерживает видеокарта — столько и генерируешь. Без ограничений по дням", color: "var(--green)" },
          ].map((b, i) => (
            <RevealOnScroll key={b.title} delay={180 + i * 80}>
              <div
                className="nit-card-glow p-5 sm:p-6 rounded-xl"
                style={{ border: "1px solid var(--line)" }}
              >
                <div className="text-2xl mb-3" style={{ filter: `drop-shadow(0 0 12px ${b.color})` }}>{b.icon}</div>
                <h3 className="font-semibold mb-2 text-[15px] sm:text-[16px]" style={{ color: "var(--ink)" }}>
                  {b.title}
                </h3>
                <p className="text-[13px] sm:text-[14px] leading-[1.55]" style={{ color: "var(--muted)" }}>
                  {b.desc}
                </p>
              </div>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}

import { useEffect, useRef, useState, useCallback } from "react";
import { Zap, Globe, Check, Terminal, Cpu } from "lucide-react";

const PHASE_DURATION = [5000, 7000, 4000];

// Фаза 1: Setup — установка LM Studio, подключение nitgen, авторизация
function SetupPhase({ active }: { active: boolean }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!active) { setStep(0); return; }
    const timers = [
      setTimeout(() => setStep(1), 800),
      setTimeout(() => setStep(2), 2000),
      setTimeout(() => setStep(3), 3200),
      setTimeout(() => setStep(4), 4200),
    ];
    return () => timers.forEach(clearTimeout);
  }, [active]);

  const steps = [
    { label: "Загрузка LM Studio...", done: step >= 1 },
    { label: "Установка модели Qwen-2.5-14B...", done: step >= 2 },
    { label: "Подключение nitgen...", done: step >= 3 },
    { label: "Авторизация пройдена", done: step >= 4 },
  ];

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 sm:p-10">
      <div className="w-full max-w-lg relative">
        <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-cyan-500/20 via-emerald-500/20 to-cyan-500/20 blur-xl animate-pulse" />
        <div className="relative rounded-xl border border-cyan-500/30 bg-[#0A0E14] p-6 shadow-[0_0_40px_rgba(0,255,200,0.05)]">
          <div className="flex items-center gap-2 mb-5 pb-3 border-b border-cyan-500/10">
            <Terminal size={14} className="text-cyan-400" />
            <span className="text-xs font-mono text-cyan-400/70">system.init</span>
          </div>
          <div className="space-y-4">
            {steps.map((s, i) => (
              <div key={i} className={`flex items-center gap-3 transition-all duration-500 ${step > i ? "opacity-100" : step === i ? "opacity-100" : "opacity-0 translate-y-2"}`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-300 ${s.done ? "bg-cyan-500/20 shadow-[0_0_10px_rgba(0,255,200,0.3)]" : "bg-white/5"}`}>
                  {s.done ? (
                    <Check size={10} className="text-cyan-400" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  )}
                </div>
                <span className={`text-sm font-mono transition-colors duration-300 ${s.done ? "text-cyan-300" : "text-cyan-500/70"}`}>{s.label}</span>
              </div>
            ))}
          </div>
          <div className={`mt-6 pt-4 border-t border-cyan-500/10 flex items-center gap-2 transition-all duration-500 ${step >= 4 ? "opacity-100" : "opacity-0"}`}>
            <Zap size={14} className="text-emerald-400" />
            <span className="text-sm font-mono text-emerald-400">Система готова к генерации</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Фаза 2: Generation — анимация магии
function GenerationPhase({ active }: { active: boolean }) {
  const [progress, setProgress] = useState(0);
  const [tokens, setTokens] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    if (!active) { setProgress(0); setTokens(0); return; }
    let step = 0;
    const interval = setInterval(() => { step++; setProgress(step); if (step >= 5) clearInterval(interval); }, 1200);
    const tokenInterval = setInterval(() => setTokens(t => t + Math.floor(Math.random() * 63 + 20)), 80);
    return () => { clearInterval(interval); clearInterval(tokenInterval); };
  }, [active]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !active) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();

    const particles: { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; hue: number }[] = [];
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    const cx = W / 2;
    const cy = H / 2;

    const spawnParticle = () => {
      const angle = Math.random() * Math.PI * 2;
      const dist = 200 + Math.random() * 100;
      particles.push({
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        vx: (cx - (cx + Math.cos(angle) * dist)) * 0.008,
        vy: (cy - (cy + Math.sin(angle) * dist)) * 0.008,
        life: 0,
        maxLife: 80 + Math.random() * 60,
        hue: 160 + Math.random() * 40,
      });
    };

    let frame = 0;
    const loop = () => {
      ctx.clearRect(0, 0, W, H);
      frame++;

      if (frame % 2 === 0 && particles.length < 80) spawnParticle();

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 1.01;
        p.vy *= 1.01;
        p.life++;

        const alpha = Math.sin((p.life / p.maxLife) * Math.PI) * 0.7;
        const size = 1.5 + alpha * 2;

        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 100%, 70%, ${alpha})`;
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 8, p.y - p.vy * 8);
        ctx.strokeStyle = `hsla(${p.hue}, 100%, 60%, ${alpha * 0.4})`;
        ctx.lineWidth = size * 0.5;
        ctx.stroke();

        if (p.life >= p.maxLife) particles.splice(i, 1);
      }

      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 60);
      grad.addColorStop(0, `hsla(170, 100%, 60%, ${0.15 + Math.sin(frame * 0.05) * 0.05})`);
      grad.addColorStop(1, "transparent");
      ctx.fillStyle = grad;
      ctx.fillRect(cx - 60, cy - 60, 120, 120);

      animRef.current = requestAnimationFrame(loop);
    };

    loop();
    return () => cancelAnimationFrame(animRef.current);
  }, [active]);

  const codeLines = [
    "<!DOCTYPE html>",
    '<html lang="ru">',
    "  <head>",
    '    <meta charset="utf-8">',
    "    <title>Кофейня</title>",
    "    <style>",
    "      .hero { background: #1a1a2e; }",
    "      .menu-grid { display: grid; }",
    "      .booking-form { padding: 2rem; }",
    "    </style>",
    "  </head>",
    "  <body>",
    '    <nav class="navbar">...</nav>',
    '    <section class="hero">...</section>',
    '    <div class="menu-grid">...</div>',
    "  </body>",
    "</html>",
  ];

  const stages = ["HTML-каркас", "Контент", "CSS-стили", "Интерактив", "Оптимизация"];

  return (
    <div className="absolute inset-0 overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{
        backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,200,0.1) 2px, rgba(0,255,200,0.1) 4px)",
      }} />

      <div className="absolute left-4 sm:left-8 top-4 sm:top-8 bottom-16 w-[45%] sm:w-[40%] overflow-hidden">
        <div className={`font-mono text-[10px] sm:text-xs space-y-1 transition-all duration-1000 ${active ? "opacity-100" : "opacity-0"}`}>
          {codeLines.map((line, i) => (
            <div
              key={i}
              className="text-cyan-300/60 whitespace-nowrap"
              style={{
                animation: active ? `slideInCode 0.3s ease-out ${i * 0.3}s both` : "none",
              }}
            >
              <span className="text-cyan-500/30 mr-2 select-none">{String(i + 1).padStart(2, "0")}</span>
              {line}
            </div>
          ))}
        </div>
      </div>

      <div className="absolute right-4 sm:right-8 top-4 sm:top-8 w-[45%] sm:w-[40%]">
        <div className="space-y-3">
          {stages.map((label, i) => (
            <div key={label} className={`transition-all duration-500 ${progress > i ? "opacity-100" : progress === i ? "opacity-70" : "opacity-20"}`} style={{ transitionDelay: `${i * 100}ms` }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] sm:text-xs font-mono text-cyan-300/80">{label}</span>
                <span className="text-[10px] font-mono text-emerald-400/60">{progress > i ? "100%" : progress === i ? "..." : ""}</span>
              </div>
              <div className="h-1 rounded-full bg-white/[0.05] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all ease-out"
                  style={{
                    width: progress > i ? "100%" : "0%",
                    transitionDuration: "1000ms",
                    background: "linear-gradient(90deg, #06b6d4, #10b981, #06b6d4)",
                    backgroundSize: "200% 100%",
                    animation: progress > i ? "shimmer 2s linear infinite" : "none",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className={`relative transition-all duration-1000 ${active ? "opacity-100 scale-100" : "opacity-0 scale-75"}`}>
          <div className="absolute -inset-16 rounded-full border border-cyan-500/10" style={{ animation: "spin 20s linear infinite" }} />
          <div className="absolute -inset-12 rounded-full border border-emerald-500/15" style={{ animation: "spin 12s linear infinite reverse" }} />
          <div className="absolute -inset-8 rounded-full border border-cyan-400/20" style={{ animation: "spin 8s linear infinite" }} />

          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-cyan-500/30 to-emerald-500/30 flex items-center justify-center shadow-[0_0_60px_rgba(0,255,200,0.2),inset_0_0_30px_rgba(0,255,200,0.1)]">
            <Cpu size={24} className="text-cyan-300 animate-pulse" />
          </div>
        </div>
      </div>

      <div className="absolute bottom-4 sm:bottom-6 left-4 sm:left-8 right-4 sm:right-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse" />
          <span className="text-xs font-mono text-cyan-300/60">{tokens.toLocaleString()} tokens</span>
        </div>
        <span className="text-xs font-mono text-emerald-400/80 animate-pulse">generating...</span>
      </div>

      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="absolute h-px rounded-full"
          style={{
            width: `${40 + Math.random() * 100}px`,
            top: `${10 + i * 7.5}%`,
            left: "-100px",
            background: `linear-gradient(90deg, transparent, ${i % 2 === 0 ? "rgba(6,182,212,0.4)" : "rgba(16,185,129,0.3)"}, transparent)`,
            animation: active ? `flyLine ${2 + Math.random() * 3}s linear ${Math.random() * 2}s infinite` : "none",
          }}
        />
      ))}
    </div>
  );
}

// Шаблоны сайтов для ResultPhase
const siteTemplates = [
  {
    label: "Кафе",
    color: "amber",
    content: () => (
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-white/90">Кофейня «Зерно»</span>
          <div className="flex gap-4"><span className="text-xs text-white/40 hover:text-white/70 cursor-pointer transition-colors">Меню</span><span className="text-xs text-white/40 hover:text-white/70 cursor-pointer transition-colors">О нас</span><span className="text-xs text-white/40 hover:text-white/70 cursor-pointer transition-colors">Контакты</span></div>
        </div>
        <div className="relative rounded-xl overflow-hidden border border-amber-500/15">
          <img src="https://images.pexels.com/photos/1235706/pexels-photo-1235706.jpeg?auto=compress&cs=tinysrgb&w=600&h=200&fit=crop" alt="Кофейня" className="w-full h-28 object-cover opacity-60" />
          <div className="absolute inset-0 bg-gradient-to-r from-amber-950/80 to-transparent p-4 flex flex-col justify-center">
            <h3 className="text-sm sm:text-base font-bold text-white mb-1">Лучший кофе в городе</h3>
            <p className="text-[10px] text-white/50 mb-2">Свежая обжарка каждый день · Завтраки</p>
            <div className="inline-flex h-6 px-3 rounded-lg bg-amber-500/80 items-center w-fit"><span className="text-[10px] text-black font-semibold">Наше меню</span></div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[{item:"Капучино",price:"280 р.",img:"https://images.pexels.com/photos/312418/pexels-photo-312418.jpeg?auto=compress&cs=tinysrgb&w=200&h=150&fit=crop"},{item:"Латте",price:"320 р.",img:"https://images.pexels.com/photos/851555/pexels-photo-851555.jpeg?auto=compress&cs=tinysrgb&w=200&h=150&fit=crop"},{item:"Круассан",price:"180 р.",img:"https://images.pexels.com/photos/1775043/pexels-photo-1775043.jpeg?auto=compress&cs=tinysrgb&w=200&h=150&fit=crop"}].map(p => (
            <div key={p.item} className="rounded-lg bg-white/[0.03] border border-white/[0.05] overflow-hidden">
              <img src={p.img} alt={p.item} className="w-full h-12 sm:h-16 object-cover opacity-60" />
              <div className="p-2"><span className="text-[10px] text-white/70 block font-medium">{p.item}</span><span className="text-[9px] text-amber-300/70">{p.price}</span></div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-amber-500/[0.06] border border-amber-500/10 p-2.5">
            <span className="text-[10px] text-amber-300/70 font-semibold block mb-0.5">Адрес</span>
            <span className="text-[10px] text-white/50">ул. Центральная, 15</span>
          </div>
          <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] p-2.5">
            <span className="text-[10px] text-white/50 font-semibold block mb-0.5">Часы работы</span>
            <span className="text-[10px] text-white/40">Пн–Вс 8:00–22:00</span>
          </div>
        </div>
        <div className="flex gap-1.5">
          {["★★★★★","4.9 (312 отзыва)"].map((t,i)=>(<span key={i} className={`text-[10px] ${i===0?"text-amber-400":"text-white/40"}`}>{t}</span>))}
        </div>
      </div>
    ),
  },
  {
    label: "Портфолио",
    color: "teal",
    content: () => (
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-white/90">Анна Петрова</span>
          <div className="flex gap-4"><span className="text-xs text-white/40">Работы</span><span className="text-xs text-white/40">Процесс</span><span className="text-xs text-white/40">Контакты</span></div>
        </div>
        <div className="flex items-center gap-3">
          <img src="https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=80&h=80&fit=crop&face" alt="Анна" className="w-12 h-12 rounded-full object-cover border-2 border-teal-500/30 shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-white/90">UI/UX Designer</h3>
            <p className="text-[10px] text-white/40">Брендинг · Интерфейсы · Иллюстрации</p>
            <div className="flex gap-1 mt-1">
              {["Figma","Adobe","Motion"].map(s=>(<span key={s} className="px-1.5 py-0.5 rounded bg-teal-500/10 border border-teal-500/15 text-[8px] text-teal-300/70">{s}</span>))}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            {url:"https://images.pexels.com/photos/196644/pexels-photo-196644.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop",tag:"Брендинг"},
            {url:"https://images.pexels.com/photos/1779487/pexels-photo-1779487.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop",tag:"Web"},
            {url:"https://images.pexels.com/photos/326503/pexels-photo-326503.jpeg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop",tag:"App"},
            {url:"https://images.pexels.com/photos/6444/pencil-typography-black-design.jpg?auto=compress&cs=tinysrgb&w=300&h=200&fit=crop",tag:"Print"},
          ].map((p,i)=>(
            <div key={i} className="relative rounded-lg overflow-hidden border border-white/[0.06] group">
              <img src={p.url} alt={p.tag} className="w-full h-16 sm:h-20 object-cover opacity-50 group-hover:opacity-70 transition-opacity" />
              <span className="absolute bottom-1 left-1.5 text-[9px] text-white/50 bg-black/40 px-1 rounded">{p.tag}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between rounded-lg bg-teal-500/[0.06] border border-teal-500/10 px-3 py-2">
          <span className="text-[10px] text-teal-300/70">Открыта для проектов</span>
          <div className="h-5 px-2 rounded bg-teal-500/20 flex items-center"><span className="text-[9px] text-teal-300/80">Написать</span></div>
        </div>
      </div>
    ),
  },
  {
    label: "Магазин",
    color: "sky",
    content: () => (
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-white/90">StyleShop</span>
          <div className="flex gap-3"><span className="text-xs text-white/40">Каталог</span><span className="text-xs text-white/40">Доставка</span><span className="text-xs text-sky-300/60">Корзина (2)</span></div>
        </div>
        <div className="relative rounded-xl overflow-hidden border border-sky-500/15">
          <img src="https://images.pexels.com/photos/1884581/pexels-photo-1884581.jpeg?auto=compress&cs=tinysrgb&w=600&h=180&fit=crop" alt="Магазин" className="w-full h-24 object-cover opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-r from-sky-950/80 to-transparent p-4 flex flex-col justify-center">
            <span className="text-[9px] text-sky-300/70 uppercase tracking-wider mb-0.5">Новая коллекция 2026</span>
            <h3 className="text-sm font-bold text-white mb-1">Скидка 20% на первый заказ</h3>
            <div className="inline-flex h-6 px-3 rounded-lg bg-sky-500/80 items-center w-fit"><span className="text-[10px] text-white font-semibold">Смотреть</span></div>
          </div>
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          {["Все","Обувь","Одежда","Аксессуары","Новинки"].map((t,i)=>(
            <span key={t} className={`px-2.5 py-1 rounded-full text-[9px] shrink-0 ${i===0?"bg-sky-500/20 border border-sky-500/30 text-sky-300/80":"bg-white/[0.03] border border-white/[0.06] text-white/40"}`}>{t}</span>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[{name:"Кроссовки",price:"4 990",old:"6 200",img:"https://images.pexels.com/photos/2529148/pexels-photo-2529148.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop"},{name:"Куртка",price:"8 790",old:"11 000",img:"https://images.pexels.com/photos/1462637/pexels-photo-1462637.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop"},{name:"Рюкзак",price:"3 290",old:"4 100",img:"https://images.pexels.com/photos/1152077/pexels-photo-1152077.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop"}].map(p => (
            <div key={p.name} className="rounded-lg bg-white/[0.03] border border-white/[0.05] overflow-hidden">
              <img src={p.img} alt={p.name} className="w-full h-14 sm:h-18 object-cover opacity-55" />
              <div className="p-2">
                <span className="text-[10px] text-white/70 block">{p.name}</span>
                <span className="text-[9px] text-sky-300/80 font-semibold">{p.price} р.</span>
                <span className="text-[8px] text-white/25 line-through ml-1">{p.old}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-lg bg-sky-500/[0.05] border border-sky-500/10 p-2.5 flex items-center justify-between">
          <span className="text-[10px] text-sky-300/60">Бесплатная доставка от 3 000 р.</span>
          <span className="text-[9px] text-white/30">2–3 дня</span>
        </div>
      </div>
    ),
  },
  {
    label: "Доставка",
    color: "red",
    content: () => (
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-white/90">FoodExpress</span>
          <div className="flex gap-3"><span className="text-xs text-white/40">Меню</span><span className="text-xs text-white/40">Зоны</span><span className="text-xs text-red-300/60">Заказать</span></div>
        </div>
        <div className="relative rounded-xl overflow-hidden border border-red-500/15">
          <img src="https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=600&h=180&fit=crop" alt="Еда" className="w-full h-24 object-cover opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-r from-red-950/90 to-transparent p-4 flex flex-col justify-center">
            <div className="flex items-center gap-1.5 mb-1"><span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"/><span className="text-[9px] text-red-300/70">Доставляем прямо сейчас</span></div>
            <h3 className="text-sm font-bold text-white mb-1">За 30 минут · Бесплатно от 1000 р.</h3>
            <div className="inline-flex h-6 px-3 rounded-lg bg-red-500/80 items-center w-fit"><span className="text-[10px] text-white font-semibold">Заказать</span></div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {[{cat:"Пицца",img:"https://images.pexels.com/photos/825661/pexels-photo-825661.jpeg?auto=compress&cs=tinysrgb&w=100&h=80&fit=crop"},{cat:"Суши",img:"https://images.pexels.com/photos/357756/pexels-photo-357756.jpeg?auto=compress&cs=tinysrgb&w=100&h=80&fit=crop"},{cat:"Бургеры",img:"https://images.pexels.com/photos/1639557/pexels-photo-1639557.jpeg?auto=compress&cs=tinysrgb&w=100&h=80&fit=crop"},{cat:"Десерты",img:"https://images.pexels.com/photos/291528/pexels-photo-291528.jpeg?auto=compress&cs=tinysrgb&w=100&h=80&fit=crop"}].map(c => (
            <div key={c.cat} className="rounded-lg overflow-hidden border border-white/[0.05]">
              <img src={c.img} alt={c.cat} className="w-full h-8 object-cover opacity-50" />
              <div className="p-1 text-center"><span className="text-[9px] text-white/50">{c.cat}</span></div>
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          {[{name:"Маргарита XL",price:"790",time:"~25 мин"},{name:"Ролл Калифорния",price:"490",time:"~20 мин"},{name:"Чизбургер Double",price:"390",time:"~15 мин"}].map(item=>(
            <div key={item.name} className="flex items-center gap-3 rounded-lg bg-white/[0.02] border border-white/[0.04] px-3 py-2">
              <span className="text-[10px] text-white/60 flex-1">{item.name}</span>
              <span className="text-[9px] text-red-300/70 font-semibold">{item.price} р.</span>
              <span className="text-[9px] text-white/30">{item.time}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    label: "Музыкант",
    color: "violet",
    content: () => (
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-white/90">DJ MaxWave</span>
          <div className="flex gap-4"><span className="text-xs text-white/40">Треки</span><span className="text-xs text-white/40">Райдер</span><span className="text-xs text-violet-300/60">Букинг</span></div>
        </div>
        <div className="relative rounded-xl overflow-hidden border border-violet-500/15">
          <img src="https://images.pexels.com/photos/1540406/pexels-photo-1540406.jpeg?auto=compress&cs=tinysrgb&w=600&h=180&fit=crop" alt="DJ" className="w-full h-24 object-cover opacity-35" />
          <div className="absolute inset-0 bg-gradient-to-r from-violet-950/90 via-violet-950/60 to-transparent p-4 flex flex-col justify-center">
            <span className="text-[9px] text-violet-300/60 uppercase tracking-wider mb-0.5">Electronic / Deep House</span>
            <h3 className="text-sm font-bold text-white mb-1">«Pulse» — новый альбом</h3>
            <div className="flex gap-1.5">
              <div className="inline-flex h-6 px-3 rounded-full bg-violet-500/80 items-center"><span className="text-[10px] text-white font-medium">▶ Слушать</span></div>
              <div className="inline-flex h-6 px-3 rounded-full bg-white/[0.06] border border-white/[0.08] items-center"><span className="text-[10px] text-white/50">Букинг</span></div>
            </div>
          </div>
        </div>
        <div className="space-y-1.5">
          {[{t:"Neon Dreams",dur:"3:42",plays:"128K"},{t:"Midnight City",dur:"4:15",plays:"94K"},{t:"Electric Pulse",dur:"3:58",plays:"67K"},{t:"Aurora",dur:"5:02",plays:"43K"}].map((tr,i)=>(
            <div key={tr.t} className="flex items-center gap-3 rounded-lg bg-white/[0.02] border border-white/[0.04] px-3 py-2">
              <div className="w-5 h-5 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0"><span className="text-[8px] text-violet-300/70">▶</span></div>
              <span className="text-[10px] text-white/70 flex-1">{tr.t}</span>
              <div className="w-16 h-1 rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-gradient-to-r from-violet-500/40 to-fuchsia-500/40" style={{width:`${70-i*12}%`}}/></div>
              <span className="text-[9px] text-white/30 w-8 text-right">{tr.dur}</span>
              <span className="text-[9px] text-violet-300/40 w-8 text-right">{tr.plays}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[{n:"48",l:"концертов"},{n:"12",l:"стран"},{n:"2.1M",l:"слушателей"}].map(s=>(
            <div key={s.l} className="rounded-lg bg-white/[0.03] border border-white/[0.04] py-2">
              <span className="text-sm font-bold text-violet-300/80 block">{s.n}</span>
              <span className="text-[9px] text-white/30">{s.l}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    label: "Фотограф",
    color: "rose",
    content: () => (
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-white/90">Мария Соколова</span>
          <div className="flex gap-4"><span className="text-xs text-white/40">Галерея</span><span className="text-xs text-white/40">Прайс</span><span className="text-xs text-rose-300/60">Запись</span></div>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <img src="https://images.pexels.com/photos/1024993/pexels-photo-1024993.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop" alt="Свадьба" className="col-span-2 row-span-2 rounded-lg h-28 sm:h-36 w-full object-cover opacity-65 border border-rose-500/10" />
          <img src="https://images.pexels.com/photos/2379005/pexels-photo-2379005.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop" alt="Портрет" className="rounded-lg h-[52px] sm:h-[68px] w-full object-cover opacity-55 border border-white/[0.05]" />
          <img src="https://images.pexels.com/photos/573299/pexels-photo-573299.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop" alt="Семья" className="rounded-lg h-[52px] sm:h-[64px] w-full object-cover opacity-55 border border-white/[0.05]" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[{name:"Портрет",price:"5 000",sub:"1–2 ч."},{name:"Свадьба",price:"25 000",sub:"Весь день"},{name:"Семейная",price:"8 000",sub:"1.5 ч."}].map(p=>(
            <div key={p.name} className="rounded-lg bg-white/[0.03] border border-white/[0.05] p-2 text-center">
              <span className="text-[10px] text-white/70 block font-medium">{p.name}</span>
              <span className="text-[10px] text-rose-300/70 font-semibold">{p.price} р.</span>
              <span className="text-[9px] text-white/25 block">{p.sub}</span>
            </div>
          ))}
        </div>
        <div className="rounded-lg bg-rose-500/[0.06] border border-rose-500/10 p-2.5 flex items-center justify-between">
          <div><span className="text-[10px] text-rose-300/70 font-medium block">Свободные даты</span><span className="text-[9px] text-white/40">Июнь — Август 2026</span></div>
          <div className="h-6 px-3 rounded-lg bg-rose-500/20 border border-rose-500/20 flex items-center"><span className="text-[9px] text-rose-300/80">Записаться</span></div>
        </div>
      </div>
    ),
  },
  {
    label: "Курс",
    color: "blue",
    content: () => (
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-white/90">WebDev Pro</span>
          <div className="flex gap-3"><span className="text-xs text-white/40">Программа</span><span className="text-xs text-white/40">Отзывы</span><span className="text-xs text-blue-300/60">Записаться</span></div>
        </div>
        <div className="relative rounded-xl overflow-hidden border border-blue-500/15">
          <img src="https://images.pexels.com/photos/546819/pexels-photo-546819.jpeg?auto=compress&cs=tinysrgb&w=600&h=160&fit=crop" alt="Программирование" className="w-full h-20 object-cover opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-r from-blue-950/90 to-transparent p-4 flex flex-col justify-center">
            <h3 className="text-sm font-bold text-white mb-0.5">Веб-разработка с нуля</h3>
            <p className="text-[9px] text-white/40 mb-2">12 недель · Диплом · Трудоустройство</p>
            <div className="flex gap-1.5">
              <div className="h-6 px-2.5 rounded-lg bg-blue-500/80 flex items-center"><span className="text-[9px] text-white font-semibold">Начать</span></div>
              <div className="h-6 px-2.5 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center"><span className="text-[9px] text-white/50">Программа →</span></div>
            </div>
          </div>
        </div>
        <div className="space-y-1.5">
          {[{m:"HTML и CSS",weeks:3,done:true},{m:"JavaScript",weeks:4,done:true},{m:"React",weeks:3,done:false},{m:"Node.js / Backend",weeks:2,done:false}].map((mod,i)=>(
            <div key={mod.m} className="flex items-center gap-3 rounded-lg bg-white/[0.02] border border-white/[0.04] px-3 py-2">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${mod.done?"bg-blue-500/30":"bg-white/[0.04]"}`}><span className="text-[8px] text-blue-300/80 font-mono">{i+1}</span></div>
              <span className="text-[10px] text-white/60 flex-1">{mod.m}</span>
              <div className="w-16 h-1 rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-blue-500/40" style={{width:mod.done?"100%":"0%"}}/></div>
              <span className="text-[9px] text-white/30">{mod.weeks} нед.</span>
            </div>
          ))}
        </div>
        <div className="flex gap-3 text-center">
          {[{n:"850+",l:"выпускников"},{n:"92%",l:"трудоустройство"},{n:"4.9★",l:"рейтинг"}].map(s=>(
            <div key={s.l} className="flex-1 rounded-lg bg-blue-500/[0.06] border border-blue-500/10 py-2">
              <span className="text-xs font-bold text-blue-300/80 block">{s.n}</span>
              <span className="text-[9px] text-white/30">{s.l}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    label: "Мероприятие",
    color: "cyan",
    content: () => (
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-white/90">TechConf 2026</span>
          <div className="flex gap-3"><span className="text-xs text-white/40">Спикеры</span><span className="text-xs text-white/40">Билеты</span><span className="text-xs text-cyan-300/60">Место</span></div>
        </div>
        <div className="relative rounded-xl overflow-hidden border border-cyan-500/15">
          <img src="https://images.pexels.com/photos/2774556/pexels-photo-2774556.jpeg?auto=compress&cs=tinysrgb&w=600&h=180&fit=crop" alt="Конференция" className="w-full h-24 object-cover opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-950/90 to-transparent p-4 flex flex-col justify-center">
            <span className="text-[9px] text-cyan-300/60 uppercase tracking-wider mb-0.5">15 августа 2026 · Москва</span>
            <h3 className="text-sm font-bold text-white mb-1">Конференция технологий</h3>
            <div className="inline-flex h-6 px-3 rounded-lg bg-cyan-500/80 items-center w-fit"><span className="text-[10px] text-[#0a0a0a] font-semibold">Купить билет</span></div>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-0.5">
          {[
            {url:"https://images.pexels.com/photos/2381069/pexels-photo-2381069.jpeg?auto=compress&cs=tinysrgb&w=80&h=80&fit=crop&face",name:"Иван С.",role:"CEO"},
            {url:"https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=80&h=80&fit=crop&face",name:"Анна К.",role:"CTO"},
            {url:"https://images.pexels.com/photos/1300402/pexels-photo-1300402.jpeg?auto=compress&cs=tinysrgb&w=80&h=80&fit=crop&face",name:"Денис М.",role:"ML"},
            {url:"https://images.pexels.com/photos/1181695/pexels-photo-1181695.jpeg?auto=compress&cs=tinysrgb&w=80&h=80&fit=crop&face",name:"Мaria L.",role:"UX"},
          ].map(sp=>(
            <div key={sp.name} className="text-center shrink-0">
              <img src={sp.url} alt={sp.name} className="w-9 h-9 rounded-full object-cover border border-cyan-500/20 mx-auto mb-0.5 opacity-70" />
              <span className="text-[9px] text-white/50 block">{sp.name}</span>
              <span className="text-[8px] text-cyan-300/40">{sp.role}</span>
            </div>
          ))}
          <div className="text-center shrink-0 flex flex-col items-center justify-center w-9">
            <div className="w-9 h-9 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-0.5"><span className="text-[9px] text-white/30">+16</span></div>
            <span className="text-[8px] text-white/25">ещё</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[{n:"20",l:"спикеров"},{n:"8 ч.",l:"программа"},{n:"500",l:"мест"}].map(s=>(
            <div key={s.l} className="rounded-lg bg-white/[0.03] border border-cyan-500/10 py-2">
              <span className="text-sm font-bold text-cyan-300/80 block">{s.n}</span>
              <span className="text-[9px] text-white/30">{s.l}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    label: "Недвижимость",
    color: "slate",
    content: () => (
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-white/90">HomeFinder</span>
          <div className="flex gap-3"><span className="text-xs text-white/40">Объекты</span><span className="text-xs text-white/40">Услуги</span><span className="text-xs text-sky-300/60">Заявка</span></div>
        </div>
        <div className="rounded-xl bg-gradient-to-r from-slate-800/40 to-zinc-800/20 border border-white/[0.06] p-4">
          <h3 className="text-sm font-bold text-white/90 mb-2">Найдите идеальное жильё</h3>
          <div className="flex gap-2">
            <div className="flex-1 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center px-3"><span className="text-[10px] text-white/25">Район, метро, адрес...</span></div>
            <div className="h-8 px-3 rounded-lg bg-sky-500/70 flex items-center"><span className="text-[10px] text-white font-semibold">Найти</span></div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            {type:"2-комн. квартира",price:"8.5 млн",area:"54 м²",img:"https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&w=200&h=120&fit=crop"},
            {type:"Студия",price:"4.2 млн",area:"28 м²",img:"https://images.pexels.com/photos/1643383/pexels-photo-1643383.jpeg?auto=compress&cs=tinysrgb&w=200&h=120&fit=crop"},
            {type:"Пентхаус",price:"22 млн",area:"120 м²",img:"https://images.pexels.com/photos/2462015/pexels-photo-2462015.jpeg?auto=compress&cs=tinysrgb&w=200&h=120&fit=crop"},
            {type:"1-комн.",price:"5.9 млн",area:"38 м²",img:"https://images.pexels.com/photos/1571468/pexels-photo-1571468.jpeg?auto=compress&cs=tinysrgb&w=200&h=120&fit=crop"},
          ].map(p=>(
            <div key={p.type} className="rounded-lg overflow-hidden border border-white/[0.05] bg-white/[0.02]">
              <img src={p.img} alt={p.type} className="w-full h-12 object-cover opacity-50" />
              <div className="p-2">
                <span className="text-[10px] text-white/60 block">{p.type}</span>
                <span className="text-[10px] text-sky-300/70 font-semibold">{p.price}</span>
                <span className="text-[9px] text-white/25 ml-1">{p.area}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-lg bg-sky-500/[0.05] border border-sky-500/10 p-2.5 text-center">
          <span className="text-[10px] text-sky-300/60">Бесплатная консультация · +7 (800) 123-45-67</span>
        </div>
      </div>
    ),
  },
  {
    label: "Фитнес",
    color: "emerald",
    content: () => (
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-white/90">FitPro Studio</span>
          <div className="flex gap-3"><span className="text-xs text-white/40">Программы</span><span className="text-xs text-white/40">Расписание</span><span className="text-xs text-emerald-300/60">Записаться</span></div>
        </div>
        <div className="relative rounded-xl overflow-hidden border border-emerald-500/15">
          <img src="https://images.pexels.com/photos/1552242/pexels-photo-1552242.jpeg?auto=compress&cs=tinysrgb&w=600&h=180&fit=crop" alt="Фитнес" className="w-full h-24 object-cover opacity-35" />
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-950/90 to-transparent p-4 flex flex-col justify-center">
            <h3 className="text-sm font-bold text-white mb-0.5">Персональные тренировки</h3>
            <p className="text-[9px] text-white/40 mb-2">Первое занятие бесплатно · Индивидуальный план</p>
            <div className="inline-flex h-6 px-3 rounded-lg bg-emerald-500/80 items-center w-fit"><span className="text-[10px] text-[#0a0a0a] font-semibold">Записаться</span></div>
          </div>
        </div>
        <div className="grid grid-cols-5 gap-1">
          {[{d:"Пн",t:"10:00"},{d:"Вт",t:"12:00"},{d:"Ср",t:"9:00"},{d:"Чт",t:"18:00"},{d:"Пт",t:"11:00"}].map(s=>(
            <div key={s.d} className="rounded-lg bg-white/[0.03] border border-white/[0.05] p-1.5 text-center">
              <span className="text-[9px] text-white/40 block">{s.d}</span>
              <span className="text-[8px] text-emerald-300/50">{s.t}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[{img:"https://images.pexels.com/photos/866021/pexels-photo-866021.jpeg?auto=compress&cs=tinysrgb&w=200&h=150&fit=crop",prog:"Силовые"},{img:"https://images.pexels.com/photos/317157/pexels-photo-317157.jpeg?auto=compress&cs=tinysrgb&w=200&h=150&fit=crop",prog:"Кардио"},{img:"https://images.pexels.com/photos/4056723/pexels-photo-4056723.jpeg?auto=compress&cs=tinysrgb&w=200&h=150&fit=crop",prog:"Йога"}].map(p=>(
            <div key={p.prog} className="rounded-lg overflow-hidden border border-white/[0.05]">
              <img src={p.img} alt={p.prog} className="w-full h-10 object-cover opacity-50" />
              <div className="p-1.5 text-center"><span className="text-[9px] text-white/50">{p.prog}</span></div>
            </div>
          ))}
        </div>
        <div className="flex gap-4 justify-center">
          {[{n:"500+",l:"клиентов"},{n:"8 лет",l:"опыта"},{n:"4.9★",l:"рейтинг"}].map(s=>(
            <div key={s.l} className="text-center"><span className="text-xs font-bold text-emerald-300/80 block">{s.n}</span><span className="text-[9px] text-white/30">{s.l}</span></div>
          ))}
        </div>
      </div>
    ),
  },
  {
    label: "Автосервис",
    color: "orange",
    content: () => (
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-white/90">AutoPro</span>
          <div className="flex gap-3"><span className="text-xs text-white/40">Услуги</span><span className="text-xs text-white/40">Прайс</span><span className="text-xs text-orange-300/60">Запись</span></div>
        </div>
        <div className="relative rounded-xl overflow-hidden border border-orange-500/15">
          <img src="https://images.pexels.com/photos/3807517/pexels-photo-3807517.jpeg?auto=compress&cs=tinysrgb&w=600&h=160&fit=crop" alt="Автосервис" className="w-full h-20 object-cover opacity-35" />
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/90 to-transparent p-4 flex flex-col justify-center">
            <h3 className="text-sm font-bold text-white mb-0.5">Ремонт любой сложности</h3>
            <p className="text-[9px] text-white/40 mb-2">Гарантия 2 года · Диагностика бесплатно</p>
            <div className="inline-flex h-6 px-3 rounded-lg bg-orange-500/80 items-center w-fit"><span className="text-[10px] text-white font-semibold">Записаться</span></div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {[{s:"Диагностика",p:"Бесплатно"},{s:"Замена масла",p:"от 1 500 р."},{s:"Шиномонтаж",p:"от 800 р."},{s:"Кузовной ремонт",p:"от 5 000 р."}].map(item=>(
            <div key={item.s} className="rounded-lg bg-white/[0.03] border border-white/[0.05] px-3 py-2 flex items-center justify-between">
              <span className="text-[10px] text-white/55">{item.s}</span>
              <span className="text-[9px] text-orange-300/60 font-medium">{item.p}</span>
            </div>
          ))}
        </div>
        <div className="rounded-lg bg-orange-500/[0.06] border border-orange-500/10 p-2.5 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-orange-300/70 font-medium block">Акция месяца</span>
            <span className="text-[9px] text-white/40">Бесплатная диагностика до 31 июня</span>
          </div>
          <div className="h-6 px-2.5 rounded-lg bg-orange-500/20 flex items-center"><span className="text-[9px] text-orange-300/80">Успеть →</span></div>
        </div>
        <div className="flex gap-3 text-center">
          {[{n:"15 лет",l:"опыта"},{n:"2 000+",l:"клиентов"},{n:"98%",l:"довольных"}].map(s=>(
            <div key={s.l} className="flex-1 rounded-lg bg-white/[0.02] border border-white/[0.04] py-2">
              <span className="text-xs font-bold text-orange-300/70 block">{s.n}</span>
              <span className="text-[9px] text-white/25">{s.l}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    label: "Дизайнер",
    color: "teal",
    content: () => (
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-white/90">Studio Form</span>
          <div className="flex gap-3"><span className="text-xs text-white/40">Кейсы</span><span className="text-xs text-white/40">Услуги</span><span className="text-xs text-teal-300/60">Контакты</span></div>
        </div>
        <div className="relative rounded-xl overflow-hidden border border-teal-500/15">
          <img src="https://images.pexels.com/photos/196645/pexels-photo-196645.jpeg?auto=compress&cs=tinysrgb&w=600&h=160&fit=crop" alt="Дизайн" className="w-full h-20 object-cover opacity-35" />
          <div className="absolute inset-0 bg-gradient-to-r from-teal-950/90 to-transparent p-4 flex flex-col justify-center">
            <h3 className="text-sm font-bold text-white mb-0.5">Дизайн, который продаёт</h3>
            <p className="text-[9px] text-white/40 mb-2">Логотипы · Брендинг · Сайты · Упаковка</p>
            <div className="inline-flex h-6 px-3 rounded-lg bg-teal-500/80 items-center w-fit"><span className="text-[10px] text-[#0a0a0a] font-semibold">Смотреть кейсы</span></div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            {k:"Логотип",price:"от 15 000",img:"https://images.pexels.com/photos/1779487/pexels-photo-1779487.jpeg?auto=compress&cs=tinysrgb&w=200&h=150&fit=crop"},
            {k:"Брендбук",price:"от 45 000",img:"https://images.pexels.com/photos/326503/pexels-photo-326503.jpeg?auto=compress&cs=tinysrgb&w=200&h=150&fit=crop"},
            {k:"Сайт",price:"от 80 000",img:"https://images.pexels.com/photos/196644/pexels-photo-196644.jpeg?auto=compress&cs=tinysrgb&w=200&h=150&fit=crop"},
          ].map(item=>(
            <div key={item.k} className="rounded-lg overflow-hidden border border-white/[0.05]">
              <img src={item.img} alt={item.k} className="w-full h-10 object-cover opacity-40" />
              <div className="p-1.5 text-center">
                <span className="text-[10px] text-white/60 block">{item.k}</span>
                <span className="text-[8px] text-teal-300/60">{item.price}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 rounded-lg bg-white/[0.02] border border-white/[0.04] px-3 py-2.5">
          <div className="flex -space-x-2">
            {["https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=40&h=40&fit=crop&face","https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=40&h=40&fit=crop&face","https://images.pexels.com/photos/1181690/pexels-photo-1181690.jpeg?auto=compress&cs=tinysrgb&w=40&h=40&fit=crop&face"].map((u,i)=>(<img key={i} src={u} alt="" className="w-6 h-6 rounded-full object-cover border border-[#0d1117] opacity-70"/>))}
          </div>
          <div><span className="text-[10px] text-white/50 block">120+ довольных клиентов</span><span className="text-[9px] text-teal-300/50">★★★★★ 4.9</span></div>
        </div>
      </div>
    ),
  },
];

const colorMap: Record<string, { border: string; text: string; hero: string }> = {
  amber: { border: "border-amber-500/10", text: "text-amber-300/80", hero: "from-amber-900/20 to-orange-900/5" },
  teal: { border: "border-teal-500/10", text: "text-teal-300/80", hero: "from-teal-900/20 to-cyan-900/5" },
  sky: { border: "border-sky-500/10", text: "text-sky-300/80", hero: "from-sky-900/20 to-blue-900/5" },
  red: { border: "border-red-500/10", text: "text-red-300/80", hero: "from-red-900/20 to-orange-900/5" },
  violet: { border: "border-violet-500/10", text: "text-violet-300/80", hero: "from-violet-900/20 to-fuchsia-900/5" },
  rose: { border: "border-rose-500/10", text: "text-rose-300/80", hero: "from-rose-900/20 to-pink-900/5" },
  blue: { border: "border-blue-500/10", text: "text-blue-300/80", hero: "from-blue-900/20 to-cyan-900/5" },
  cyan: { border: "border-cyan-500/10", text: "text-cyan-300/80", hero: "from-cyan-900/20 to-teal-900/5" },
  slate: { border: "border-slate-400/10", text: "text-slate-300/80", hero: "from-slate-800/30 to-zinc-800/10" },
  emerald: { border: "border-emerald-500/10", text: "text-emerald-300/80", hero: "from-emerald-900/20 to-teal-900/5" },
  orange: { border: "border-orange-500/10", text: "text-orange-300/80", hero: "from-orange-900/20 to-amber-900/5" },
};

// Фаза 3: Result — кликабельная сетка мини-сайтов
function ResultPhase({ active }: { active: boolean }) {
  const [show, setShow] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    if (!active) { setShow(false); setExpanded(null); return; }
    const t1 = setTimeout(() => setShow(true), 400);
    return () => clearTimeout(t1);
  }, [active]);

  return (
    <div className="absolute inset-0 flex flex-col bg-[#0A0E14] overflow-hidden">
      <div className={`absolute inset-0 flex flex-col transition-all duration-500 ${expanded !== null ? "opacity-0 scale-95 pointer-events-none" : "opacity-100 scale-100"}`}>
        <div className="shrink-0 px-4 sm:px-6 pt-3 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center shadow-[0_0_8px_rgba(16,185,129,0.3)]">
              <Check size={9} className="text-emerald-400" />
            </div>
            <span className="text-xs font-mono text-emerald-400/80">Демо шаблонов</span>
          </div>
          <span className="text-[10px] text-white/30 font-mono">нажмите на любой</span>
        </div>

        <div className="flex-1 overflow-hidden px-3 sm:px-4 pb-2">
          <div className={`grid grid-cols-3 sm:grid-cols-4 gap-1.5 sm:gap-2 h-full transition-all duration-700 ${show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
            {siteTemplates.map((site, i) => {
              const c = colorMap[site.color] || colorMap.teal;
              return (
                <button
                  key={site.label}
                  onClick={() => setExpanded(i)}
                  className={`rounded-lg border ${c.border} bg-[#0D1117] overflow-hidden flex flex-col transition-all duration-300 hover:scale-[1.03] hover:border-opacity-100 hover:shadow-lg cursor-pointer text-left`}
                  style={{ animation: show ? `fadeSlideUp 0.4s ease-out ${i * 60}ms both` : "none" }}
                >
                  <div className="flex items-center gap-1 px-1.5 py-0.5 border-b border-white/[0.04]">
                    <div className="flex gap-0.5">
                      <span className="w-1 h-1 rounded-full bg-white/10" />
                      <span className="w-1 h-1 rounded-full bg-white/10" />
                      <span className="w-1 h-1 rounded-full bg-white/10" />
                    </div>
                  </div>
                  <div className="flex-1 p-1.5 flex flex-col gap-0.5">
                    <div className="flex items-center justify-between">
                      <div className="h-1 w-5 rounded bg-white/10" />
                      <div className="flex gap-0.5"><div className="h-0.5 w-2 rounded bg-white/[0.06]" /><div className="h-0.5 w-2 rounded bg-white/[0.06]" /></div>
                    </div>
                    <div className={`rounded bg-gradient-to-r ${c.hero} flex-1 min-h-0 p-1.5 flex flex-col justify-center`}>
                      <div className="h-1 w-3/4 rounded bg-white/[0.12]" />
                      <div className="h-0.5 w-1/2 rounded bg-white/[0.06] mt-0.5" />
                      <div className="h-2 w-6 rounded bg-white/[0.08] mt-1" />
                    </div>
                    <div className="flex gap-0.5"><div className="h-2 flex-1 rounded bg-white/[0.03]" /><div className="h-2 flex-1 rounded bg-white/[0.03]" /></div>
                  </div>
                  <div className="px-1.5 py-1 border-t border-white/[0.04]">
                    <span className={`text-[7px] sm:text-[8px] ${c.text} font-medium`}>{site.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className={`shrink-0 px-4 sm:px-6 py-2.5 border-t border-white/[0.04] flex items-center justify-center transition-all duration-500 ${show ? "opacity-100" : "opacity-0"}`}>
          <span className="text-[11px] text-white/40">и ещё <span className="text-cyan-300/70 font-medium">сотни ниш</span> — ИИ создаст сайт под любой бизнес</span>
        </div>
      </div>

      <div className={`absolute inset-0 flex flex-col transition-all duration-500 ${expanded !== null ? "opacity-100 scale-100" : "opacity-0 scale-105 pointer-events-none"}`}>
        <div className="flex items-center gap-2 px-4 sm:px-5 py-2 border-b border-cyan-500/10 bg-[#0D1117] shrink-0">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/40" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/40" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/40" />
          </div>
          <div className="flex-1 mx-3 h-6 rounded-md bg-white/[0.04] border border-white/[0.06] flex items-center px-3">
            <Globe size={10} className="text-cyan-400/50 mr-2" />
            <span className="text-[10px] text-cyan-300/50 font-mono">{expanded !== null ? `${siteTemplates[expanded].label.toLowerCase().replace(/\s/g, "-")}.html` : ""}</span>
          </div>
          <button
            onClick={() => setExpanded(null)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            <span className="text-[10px] text-white/60">Назад</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {expanded !== null && siteTemplates[expanded].content()}
        </div>

        <div className="shrink-0 px-4 sm:px-6 py-2 border-t border-white/[0.04] flex items-center justify-between">
          <span className="text-[10px] text-white/30 font-mono">демо-шаблон</span>
          <span className={`text-[10px] font-medium ${expanded !== null ? (colorMap[siteTemplates[expanded].color]?.text || "text-white/50") : ""}`}>
            {expanded !== null ? siteTemplates[expanded].label : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

const tabs = [
  { num: "01", label: "Установка", icon: <Terminal size={14} /> },
  { num: "02", label: "Генерация", icon: <Zap size={14} /> },
  { num: "03", label: "Результат", icon: <Globe size={14} /> },
];

export default function HowItWorks() {
  const [phase, setPhase] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  const scheduleNext = useCallback((current: number) => {
    if (current === 2) return;
    timerRef.current = setTimeout(() => {
      const next = current + 1;
      setPhase(next);
      if (next < 2) scheduleNext(next);
    }, PHASE_DURATION[current]);
  }, []);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (isVisible) {
      scheduleNext(phase);
    } else if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, scheduleNext]);

  const goToPhase = (i: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPhase(i);
    if (i < 2) scheduleNext(i);
  };

  return (
    <section id="how-it-works" ref={sectionRef} className="py-24 relative">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-cyan-500/[0.02] blur-[100px] pointer-events-none" />

      <div className="max-w-6xl mx-auto px-5 sm:px-8 relative">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white mb-4">
            Как бесплатно создать сайт через ИИ
          </h2>
          <p className="text-[#71717A] text-lg max-w-2xl mx-auto">
            Три простых шага — от идеи до готового сайта. Нейросеть сделает всю работу за вас.
          </p>
        </div>

        <div className="relative rounded-2xl border border-cyan-500/[0.08] bg-[#0A0E14] overflow-hidden shadow-[0_0_80px_rgba(0,255,200,0.02)]" style={{ height: "clamp(380px, 55vw, 520px)" }}>
          <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: "linear-gradient(rgba(6,182,212,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.3) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

          <div className={`absolute inset-0 transition-opacity duration-700 ${phase === 0 ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
            <SetupPhase active={phase === 0} />
          </div>
          <div className={`absolute inset-0 transition-opacity duration-700 ${phase === 1 ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
            <GenerationPhase active={phase === 1} />
          </div>
          <div className={`absolute inset-0 transition-opacity duration-700 ${phase === 2 ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
            <ResultPhase active={phase === 2} />
          </div>
        </div>

        <div className="mt-6">
          <div className="h-px bg-white/[0.06] rounded-full mb-5 overflow-hidden relative">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out relative"
              style={{
                width: `${((phase + 1) / 3) * 100}%`,
                background: "linear-gradient(90deg, #06b6d4, #10b981)",
                boxShadow: "0 0 8px rgba(6,182,212,0.4)",
              }}
            />
          </div>

          <div className="flex items-center justify-center gap-2 sm:gap-4">
            {tabs.map((tab, i) => (
              <button
                key={i}
                onClick={() => goToPhase(i)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm transition-all duration-300 ${
                  phase === i
                    ? "bg-cyan-500/[0.08] text-cyan-300 border border-cyan-500/20 shadow-[0_0_12px_rgba(6,182,212,0.1)]"
                    : "text-[#71717A] hover:text-cyan-400/70 border border-transparent"
                }`}
              >
                <span className={`transition-colors duration-300 ${phase === i ? "text-cyan-400" : ""}`}>{tab.icon}</span>
                <span className="font-mono text-xs opacity-50">{tab.num}</span>
                <span className="font-medium hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-14">
          <p className="text-center text-sm text-[#71717A] max-w-3xl mx-auto leading-relaxed">
            Бесплатное создание сайтов через ИИ — это просто. Скачайте nitgen, установите LM Studio
            с любой нейросетью, опишите свой проект — и получите готовый сайт.
            Искусственный интеллект генерирует уникальный HTML-код, который работает на любом хостинге.
          </p>
        </div>
      </div>
    </section>
  );
}

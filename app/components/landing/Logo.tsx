export default function Logo({ size = 32 }: { size?: number }) {
  const s = size;
  const inner = s * 0.5;

  return (
    <div
      className="relative flex items-center justify-center rounded-xl bg-gradient-to-br from-white via-white/95 to-white/80 shadow-[0_0_20px_rgba(255,255,255,0.15)]"
      style={{ width: s, height: s }}
    >
      <svg width={inner} height={inner} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Neural network / abstract N mark */}
        <path
          d="M6 20V4L18 20V4"
          stroke="#0A0A0A"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Узлы */}
        <circle cx="6" cy="4" r="1.8" fill="#0A0A0A" />
        <circle cx="6" cy="20" r="1.8" fill="#0A0A0A" />
        <circle cx="18" cy="4" r="1.8" fill="#0A0A0A" />
        <circle cx="18" cy="20" r="1.8" fill="#0A0A0A" />
        <circle cx="12" cy="12" r="1.5" fill="#10b981" />
      </svg>
    </div>
  );
}

/**
 * NeuralBackground — анимированная фоновая сетка точек, реагирующая на мышь.
 * Canvas рендерится в useEffect → SSR-safe.
 */
import { useEffect, useRef } from "react";

interface Point {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseX: number;
  baseY: number;
}

export default function NeuralBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const pointsRef = useRef<Point[]>([]);
  const rafRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas!.width = width;
      canvas!.height = height;
      initPoints();
    }

    function initPoints() {
      const points: Point[] = [];
      const spacing = 90;
      const cols = Math.ceil(width / spacing) + 2;
      const rows = Math.ceil(height / spacing) + 2;

      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
          const x = j * spacing + (i % 2 === 0 ? 0 : spacing * 0.5);
          const y = i * spacing * 0.866;
          points.push({ x, y, vx: 0, vy: 0, baseX: x, baseY: y });
        }
      }
      pointsRef.current = points;
    }

    function animate() {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      const mouse = mouseRef.current;
      const points = pointsRef.current;
      const maxDist = 200;
      const repelStrength = 25;

      for (const p of points) {
        const dx = mouse.x - p.baseX;
        const dy = mouse.y - p.baseY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < maxDist) {
          const force = (1 - dist / maxDist) * repelStrength;
          const angle = Math.atan2(dy, dx);
          p.vx += -Math.cos(angle) * force * 0.02;
          p.vy += -Math.sin(angle) * force * 0.02;
        }

        const springX = (p.baseX - p.x) * 0.03;
        const springY = (p.baseY - p.y) * 0.03;
        p.vx += springX;
        p.vy += springY;
        p.vx *= 0.9;
        p.vy *= 0.9;
        p.x += p.vx;
        p.y += p.vy;
      }

      // Соединения (треугольники)
      const connectionDist = 120;
      ctx.lineWidth = 0.5;

      for (let i = 0; i < points.length; i++) {
        const a = points[i];
        for (let j = i + 1; j < points.length; j++) {
          const b = points[j];
          const d = Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
          if (d > connectionDist) continue;

          const midX = (a.x + b.x) / 2;
          const midY = (a.y + b.y) / 2;
          const mDist = Math.sqrt((mouse.x - midX) ** 2 + (mouse.y - midY) ** 2);

          if (mDist < maxDist) {
            const intensity = (1 - mDist / maxDist) * 0.25;
            ctx.strokeStyle = `rgba(16, 185, 129, ${intensity})`;
          } else {
            ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
          }

          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      // Точки
      for (const p of points) {
        const mDist = Math.sqrt((mouse.x - p.x) ** 2 + (mouse.y - p.y) ** 2);
        if (mDist < maxDist) {
          const intensity = (1 - mDist / maxDist) * 0.6;
          ctx.fillStyle = `rgba(16, 185, 129, ${intensity})`;
          const r = 1.5 + intensity * 1.5;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      rafRef.current = requestAnimationFrame(animate);
    }

    function onMouseMove(e: MouseEvent) {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    }

    function onMouseLeave() {
      mouseRef.current = { x: -1000, y: -1000 };
    }

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseleave", onMouseLeave);
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseleave", onMouseLeave);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-0"
      style={{ opacity: 0.7 }}
    />
  );
}

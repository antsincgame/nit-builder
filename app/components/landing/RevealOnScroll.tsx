/**
 * RevealOnScroll — wrapper который добавляет .in при появлении в viewport.
 * Лёгкая обёртка через IntersectionObserver.
 */

import { useEffect, useRef, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "header" | "article";
};

export function RevealOnScroll({ children, delay = 0, className = "", as: Tag = "div" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setTimeout(() => el.classList.add("in"), delay);
            io.unobserve(el);
          }
        });
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);
  const Comp = Tag as "div";
  return (
    <Comp ref={ref as never} className={`nit-reveal ${className}`}>
      {children}
    </Comp>
  );
}

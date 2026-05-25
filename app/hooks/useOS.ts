/**
 * useOS — определяет ОС пользователя по navigator.userAgent.
 * SSR-safe: первый рендер всегда 'unknown', обновляется после mount.
 * Без useEffect был бы hydration mismatch — SSR не знает реального UA.
 */
import { useEffect, useState } from "react";

export type OS = "windows" | "macos" | "linux" | "unknown";

export function useOS(): OS {
  const [os, setOs] = useState<OS>("unknown");

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("win")) setOs("windows");
    else if (ua.includes("mac")) setOs("macos");
    else if (ua.includes("linux") || ua.includes("x11")) setOs("linux");
  }, []);

  return os;
}

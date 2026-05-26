import { useEffect } from "react";
import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => [
  { title: "Регистрация · nitgen" },
  { name: "robots", content: "noindex" },
];

/**
 * Register v5 — passwordless flow, регистрация автоматическая через magic-link.
 *
 * Эта страница оставлена для обратной совместимости со старыми ссылками,
 * но просто редиректит на /login где юзер вводит email и получает magic-link.
 * Новый email → создаём аккаунт автоматически.
 */
export default function Register() {
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.location.replace("/login");
    }
  }, []);

  return null;
}

/**
 * Root index route (/) — всегда лендинг, для всех.
 *
 * Раньше loader 302-ил залогиненных на /app — из-за этого клик по лого
 * «не работал»: юзера тут же возвращало в кабинет. Теперь / — это
 * лендинг без условий (один URL = один контент), а залогиненный видит
 * в навигации кнопку «Открыть приложение».
 */

import Landing from "./landing";

export function meta() {
  return [
    { title: "NITGEN — Создавай сайты бесплатно" },
    {
      name: "description",
      content:
        "Расскажите, что вы делаете — приложение само соберёт сайт. Без программирования, без подписок, всё работает на вашем компьютере.",
    },
    { property: "og:title", content: "NITGEN — Создавай сайты бесплатно" },
    {
      property: "og:description",
      content:
        "Простые сайты без программистов и подписок. Работает на вашем компьютере.",
    },
    { tagName: "link", rel: "canonical", href: "https://nitgen.org/" },
  ];
}

export default function Index() {
  return <Landing />;
}

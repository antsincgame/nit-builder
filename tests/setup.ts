/**
 * Глобальный setup для всех vitest прогонов.
 *
 * - jest-dom matchers (toBeInTheDocument, toHaveTextContent и т.п.) —
 *   подключаются глобально, не нужно импортировать в каждом UI-тесте.
 * - Очистка DOM между тестами — RTL делает это сам через `cleanup()`,
 *   но мы явно регистрируем afterEach чтобы было понятно.
 * - Мок для `window.matchMedia` — некоторые компоненты Tailwind/анимаций
 *   обращаются к нему при mount, jsdom не имплементирует.
 */

import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

// jsdom не имплементирует matchMedia. Без mock'а компоненты с
// `window.matchMedia(...)` падают на mount.
if (typeof window !== "undefined" && !window.matchMedia) {
  // Определяем как writable=true чтобы тесты могли переопределить при нужде.
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// localStorage / sessionStorage.
//
// jsdom их предоставляет, НО на Node >= 22.4 появился НАТИВНЫЙ
// globalThis.localStorage, недоступный без флага --localstorage-file
// (обращение даёт undefined + ExperimentalWarning). В связке с vitest 4 + jsdom
// он по-разному (зависит от минорной версии Node / воркера) перебивает
// jsdom-овский Storage — тесты, дёргающие window.localStorage, падают с
// "Cannot read properties of undefined (reading 'clear')".
//
// Ставим детерминированный in-memory Storage НЕЗАВИСИМО от версии Node. Покрыты
// все используемые методы (getItem/setItem/removeItem/clear/key/length); никаких
// jsdom-специфичных Storage-семантик (events, quota) тесты не используют.
if (typeof window !== "undefined") {
  const createStorageMock = (): Storage => {
    let store: Record<string, string> = {};
    return {
      get length() {
        return Object.keys(store).length;
      },
      clear() {
        store = {};
      },
      getItem(key: string) {
        return Object.prototype.hasOwnProperty.call(store, key) ? store[key]! : null;
      },
      key(index: number) {
        return Object.keys(store)[index] ?? null;
      },
      removeItem(key: string) {
        delete store[key];
      },
      setItem(key: string, value: string) {
        store[key] = String(value);
      },
    };
  };
  for (const name of ["localStorage", "sessionStorage"] as const) {
    Object.defineProperty(window, name, {
      writable: true,
      configurable: true,
      value: createStorageMock(),
    });
  }
}

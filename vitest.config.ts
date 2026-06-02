import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    // Default config используется обоими project'ами через extends.
    // По factu это разные project'ы (см. test.projects ниже) — тестам в
    // tests/ui/ нужен jsdom, остальным node. Раньше разделялось через
    // deprecated `environmentMatchGlobs`.
    globals: false,
    setupFiles: ["./tests/setup.ts"],
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          // Раньше было только `tests/**/*.test.ts` — коллокированные тесты
          // (app/lib/**/*.test.ts) НЕ запускались. У нас на момент правки
          // 3 таких файла в app/lib/bake/ (compileTailwind, extractZones,
          // htmlToPhp), все рабочие — их CI игнорировал. Расширяем include
          // чтобы такие тесты тоже подбирались.
          include: [
            "tests/**/*.test.ts",
            "app/**/*.test.ts",
          ],
          exclude: ["tests/ui/**"],
          // Argon2 и параллельные воркеры иногда «крадут» CPU: 5s не хватает.
          testTimeout: 15_000,
        },
      },
      {
        extends: true,
        test: {
          name: "ui",
          environment: "jsdom",
          include: [
            "tests/ui/**/*.test.{ts,tsx}",
            "tests/**/*.test.tsx",
            "app/**/*.test.tsx",
          ],
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json", "lcov"],
      reportsDirectory: "coverage",
      include: [
        "app/lib/services/**/*.ts",
        "app/lib/utils/**/*.ts",
        "app/lib/server/**/*.ts",
        "app/lib/llm/**/*.ts",
        "app/lib/eval/**/*.ts",
        "app/lib/image/**/*.ts",
        "app/lib/config/**/*.ts",
        "app/lib/contexts/**/*.{ts,tsx}",
        "app/lib/hooks/**/*.{ts,tsx}",
        "app/lib/bake/**/*.ts",
        "shared/src/**/*.ts",
      ],
      exclude: [
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/types.ts",
        "**/*.types.ts",
        "app/lib/eval/queries*.ts",
        "app/lib/rag/seeds/**",
        "app/lib/utils/logger.ts",
      ],
      // Coverage baseline (пере-базировано под vitest 4).
      //
      // vitest 4 перешёл на более строгий AST-aware v8-движок: при ТЕХ ЖЕ
      // тестах он считает покрытие ниже, чем v3 (точнее размечает ветки и
      // недостижимые узлы). Фактические цифры на v4:
      //   statements 62.3 · branches 57.9 · functions 66.2 · lines 64.0.
      // Это НЕ просадка реального покрытия — тесты те же, изменился счётчик.
      //
      // Threshold выставлен НИЖЕ фактического с буфером ~3pp — защита от
      // регрессий (удалили тесты / добавили мёртвый код), но достаточный
      // запас под добавление новых модулей с неполным branch-покрытием
      // (пример: phpSqliteArtifactBuilder со своими ~48% branches тянет вниз).
      //
      // ВАЖНО про branches: v8 считает ВСЕ ?: тернарники и `??`/`||`/`&&`
      // короткозамыкания как отдельные ветки, в т.ч. никогда-не-достигаемые
      // при типовом юз-кейсе — поэтому абсолютное число branches невысокое.
      thresholds: {
        lines: 61,
        functions: 63,
        branches: 55,
        statements: 59,
      },
    },
  },
});

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
      // Coverage baseline (см. CHANGELOG, бэкенд-фичи P4 + tunnel v2):
      //   lines/statements ~70%, functions ~81%, branches ~76%.
      // Threshold выставлен НИЖЕ текущего уровня с буфером ~3-4pp —
      // защита от регрессий (удалили тесты / добавили мёртвый код), но
      // достаточный запас под добавление новых модулей с неполным
      // branch-покрытием (свежий пример: phpSqliteArtifactBuilder со
      // своими 48% branches тянет общий показатель вниз).
      //
      // ВАЖНО про branches: V8 coverage считает ВСЕ ?: тернарники и
      // `??`/`||`/`&&` короткозамыкания как отдельные ветки, в т.ч.
      // никогда-не-достигаемые при типовом юз-кейсе. Поэтому 77% было
      // слишком оптимистично — баланс между «ловим регрессии» и «не
      // блочим разработку» лежит около 73%.
      thresholds: {
        lines: 64,
        functions: 75,
        branches: 73,
        statements: 64,
      },
    },
  },
});

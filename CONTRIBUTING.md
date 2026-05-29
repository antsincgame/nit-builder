# Contributing to NIT Builder

Thanks for wanting to contribute. The most valuable contribution is **adding new HTML templates** — they directly improve results for users.

## Adding a new template (most impactful)

Templates are plain HTML files. You don't need to understand the AI pipeline — just write good HTML.

### Steps

1. **Pick a category that's missing.** Check [existing templates](./app/templates/html/) and [issues tagged `template`](https://github.com/antsincgame/nit-builder/issues?q=label%3Atemplate). The 22 built-ins already cover coffee shops, barbershops, photographers, dev portfolios, weddings, fitness, restaurants, tutors, beauty, auto shops, handmade, DJs, SaaS, medical, yoga, tattoo, flowers, language schools, law firms, indie game studios and real estate. Good candidates not yet covered: bar/pub, psychologist/therapist, dog groomer, ceramics/pottery studio, car dealership, travel agency, event venue, nonprofit/charity, newsletter landing.

2. **Write the HTML** in `app/templates/html/your-template-id.html`. Rules:
   - **Single file only.** From `<!DOCTYPE html>` to `</html>`.
   - **Tailwind via CDN:** `<script src="https://cdn.tailwindcss.com"></script>`. (The Tailwind compile step inlines this into `<style>` post-generation, so the CDN reference is only needed in the source template.)
   - **Alpine.js via CDN** for interactivity (dropdown menus, tabs): `<script defer src="https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js"></script>`.
   - **Images from Unsplash only:** `https://images.unsplash.com/photo-ID?w=800` (get IDs from [unsplash.com](https://unsplash.com)).
   - **No local files** — no `.css`, no `.js`, no `.png`, no `npm` packages.
   - **Responsive:** use `sm:`, `md:`, `lg:` classes. Test at mobile width (375px) in browser devtools.
   - **Semantic HTML:** proper `<nav>`, `<main>`, `<section>`, `<footer>`, heading hierarchy.
   - **One distinct color mood:** warm, cool, dark, bold, pastel — pick one and commit to it. Don't mix.
   - **Realistic placeholder content** in Russian by default (NIT Builder targets CIS small business). English is fine for dev/IT portfolios.
   - **Size target:** 5-15 KB. Too small = not enough structure for LLM to adapt. Too big = wastes context window on 7B models.

3. **Add metadata** in [`app/lib/config/htmlTemplatesCatalog.ts`](./app/lib/config/htmlTemplatesCatalog.ts):
   ```ts
   {
     id: "your-template-id",           // must match filename
     name: "Display Name",              // shown in UI grid
     category: "service",               // see enum in TemplateMeta
     description: "What this template is for. Used by Planner LLM to match user requests.",
     bestFor: ["keyword1", "keyword2"], // Russian keywords the Planner should trigger on
     sections: ["hero", "services"],    // what sections the template contains
     style: "clean-medical",
     colorMood: "light-minimal",        // one of the 7 moods from PlanSchema
     emoji: "\ud83e\uddb7",                        // displayed in TemplateGrid
   }
   ```

4. **Add a quick prompt example** in [`app/components/simple/TemplateGrid.tsx`](./app/components/simple/TemplateGrid.tsx):
   ```ts
   "your-template-id": "Сайт для [business] с [key features]",
   ```

5. **Test locally:**
   ```bash
   npm run dev
   # Open http://localhost:5173
   # Click your template in the grid
   # Verify generation works on Qwen-7B via LM Studio (v2 is local-only)
   ```

6. **Open a PR** with:
   - Screenshot of the template at 1280×800
   - Screenshot at mobile width (375×812)
   - One real-world test prompt that should match it
   - Confirmation that `npm run lint`, `npm run typecheck` and `npm run test` pass

### What makes a great template

- **Distinctive style** — not generic. A coffee shop template should feel like a coffee shop, not a SaaS landing repainted brown.
- **Strong hero section** — this is where the user first looks. Big headline, clear value prop, prominent CTA.
- **3-5 content sections** — enough to feel complete, few enough to not overwhelm.
- **Clean typography** — use Google Fonts via `<link>`. 1-2 font families max.
- **Realistic copy** — not "Lorem ipsum". Write as if you were opening this business. It helps the LLM understand tone.

Look at [`coffee-shop.html`](./app/templates/html/coffee-shop.html), [`portfolio-dev.html`](./app/templates/html/portfolio-dev.html), and [`barbershop.html`](./app/templates/html/barbershop.html) as reference quality.

---

## Reporting bugs

Open an issue with:
- What you did (exact prompt used if applicable)
- LM Studio model and quantization
- What you expected
- What happened instead
- Browser console errors (if any)
- Server logs from `npm run dev`

---

## Code contributions

For code changes (pipeline, auth, UI, tunnel, PHP-baker):

1. **Open an issue first** describing the problem or proposed feature — avoids wasted work if the direction doesn't fit.
2. **Fork + branch:** `git checkout -b feat/your-feature`.
3. **Add tests** for anything non-trivial. Current test files in `tests/` (80+ files) are good examples.
4. **Run checks locally:**
   ```bash
   npm run lint
   npm run typecheck
   npm run test
   npm run build
   ```
5. **Keep PRs small.** One feature or fix per PR. Refactors go in separate PRs from features.

### Project structure

This is a **workspace monorepo** (npm workspaces). The four pieces:

```
nit-builder/
├── app/                    # React Router v7 SSR app (the VPS-side)
│   ├── routes/             # Routes explicitly registered in app/routes.ts
│   │                       # (v7 is NOT file-based — each route added by hand)
│   ├── components/         # landing/ · simple/ (main flow) · settings/ · nit/
│   ├── lib/
│   │   ├── bake/           # HTML→PHP baker, Tailwind compile, ZIP bundler
│   │   ├── config/         # Template catalog, system prompts, design tokens
│   │   ├── eval/           # Eval harness (runEval, htmlSmoke, reports)
│   │   ├── image/          # Image provider plugins (Unsplash, SD WebUI, stub)
│   │   ├── llm/            # LM Studio client + style presets
│   │   │                   # (v2 is local-only — cloud providers removed)
│   │   ├── rag/            # RAG seed corpora (planExamples, copywritingBank)
│   │   ├── server/         # Auth, CSRF, session cookies, Appwrite, WS handlers
│   │   ├── services/       # Pipeline: orchestrator, planner, polish, RAG search,
│   │   │                   # BM25, embeddings, reranker, RRF fusion, feedback
│   │   ├── stores/         # Client-side stores (history, toast)
│   │   └── utils/          # Logger, rate limit, plan schemas, sanitizer
│   └── templates/
│       ├── html/           # 22 HTML site templates
│       └── admin-php/      # PHP admin panel (baked into PHP bundle output)
├── shared/                 # @nit/shared — WS protocol types, server version
├── tunnel/                 # nit-tunnel CLI (Node) — local LM Studio proxy
├── tunnel/desktop/         # Tauri 2.0 + Rust — desktop tunnel client with tray
├── tests/                  # Vitest, 80+ test files
├── scripts/                # Eval runners, deploy helpers, version sync
└── server.ts               # Custom HTTP + WS server (run via tsx, NOT plain node)
```

### Working with workspaces

```bash
# Run/build the main app
npm run dev          # SSR dev server on :5173
npm run build        # production build into build/
npm start            # tsx server.ts (needs prior build)

# Work on the WS protocol or tunnel client
npm run shared:build       # builds the @nit/shared workspace
npm run tunnel:dev         # runs the tunnel CLI in dev mode
npm run tunnel:build       # production build of the tunnel CLI

# Desktop client (Tauri) — see tunnel/desktop/README.md
cd tunnel/desktop
# follow per-platform setup; main repo CI does NOT cover Tauri builds
```

Deeper architectural write-up: [`docs/architecture/v2-tunnel.md`](./docs/architecture/v2-tunnel.md).

### Coding conventions

- **TypeScript strict mode** — no `any`, no `@ts-ignore`
- **Functional React** — no classes, hooks only
- **Async generators** for streaming pipelines (see `htmlOrchestrator.types.ts` → `PipelineEvent`)
- **Zod** for runtime validation of LLM outputs and API inputs
- **No external state libraries** — `useState` + custom stores in `app/lib/stores/` are enough for current scope
- **Comments and commit messages in Russian; code identifiers in English** — see existing commits and `CHANGELOG.md` for the established tone
- **`.server.ts` suffix** for server-only modules (must not be imported from client components)

### Releasing

Version bumps run an automated sync via `scripts/sync-version.mjs` (the npm `version` lifecycle hook). `NIT_SERVER_VERSION` in `shared/src/version.ts` is rewritten from `package.json` and added to the same commit. Don't bump the constant by hand.

```bash
npm version patch    # 2.0.0-beta.1 → 2.0.0-beta.2, syncs shared/src/version.ts
npm version minor    # → 2.1.0
```

`NIT_TUNNEL_CLIENT_VERSION` is on its own release cycle (the desktop client) and is **not** touched by this hook.

---

## License

By contributing you agree your code is released under the [MIT License](./LICENSE).

---

Questions? Open a discussion or ping [@igor1000rr](https://t.me/igor1000rr) on Telegram.

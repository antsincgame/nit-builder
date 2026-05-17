# NIT Builder

> **Create websites on your own GPU. With AI. For free.**
> Peer-to-peer AI HTML site builder. Your browser → our server → your desktop LM Studio. No cloud inference, no subscription, your prompts never leave your machine.

![License](https://img.shields.io/badge/license-MIT-blue)
![Node](https://img.shields.io/badge/node-%3E%3D20-green)
![Status](https://img.shields.io/badge/status-beta-orange)

[🇷🇺 Русская версия](./README.ru.md)

---

## What is this?

NIT Builder is an open-source AI website generator built around a **peer-to-peer tunnel architecture**: the web app runs on our VPS, but every LLM call is proxied through a WebSocket tunnel into **your own LM Studio** on **your own machine**. No cloud inference provider sees your prompts. You bring the GPU, we bring the pipeline.

You describe a site in plain language → a Planner LLM emits a JSON plan → the system picks one of 22 HTML templates → a Coder LLM adapts the template → optionally bakes a flat-file PHP admin panel into the bundle. Total time: 30–60 seconds.

**Key difference from Tilda/Wix/v0/Bolt:** inference runs locally on your hardware. The VPS only orchestrates. Generated sites are pure HTML + Tailwind (compiled inline, not via CDN) + optional PHP admin — they run anywhere.

### Who it's for

- Small business owners who don't want a 1500₽/month Tilda subscription forever
- Freelancers shipping quick client sites
- Students with an RTX 3060 and no budget
- Anyone who wants a website **and** wants to own the data

---

## Architecture (v2)

```
Browser ─── HTTPS ───▶ NIT VPS (this repo, app/)
                       │
                       │  WSS /api/control  (browser session)
                       │  WSS /api/tunnel   (desktop client)
                       ▼
                  Tunnel router  ◀── routes per user via tunnel-token
                       ▲
                       │ WSS
                       │
            Desktop client (Tauri + Rust, tunnel/desktop/)
                       │
                       ▼
              Your local LM Studio (OpenAI-compatible)
```

This repo is a workspace monorepo:

- `app/` — React Router v7 SSR + WS handlers (the VPS)
- `shared/` — shared protocol types (`@nit/shared`)
- `tunnel/` — Node CLI client (`nit-tunnel`)
- `tunnel/desktop/` — Tauri 2.0 + Rust desktop client with tray icon, autostart, auto-update

Deeper write-up: [docs/architecture/v2-tunnel.md](./docs/architecture/v2-tunnel.md)

---

## Pipeline

```
User prompt ("a coffee shop in Minsk")
        ↓
  Planner LLM ──▶ JSON plan (business_type, tone, sections, colors, needs_admin, …)
        ↓
  Template retriever (BM25 + dense embeddings + RRF fusion + reranker)
        ↓
  Coder LLM ──▶ adapts the chosen HTML template, streams the result
        ↓
  Polisher cascade (css_patch → section-only → full_rewrite)
        ↓
  Tailwind v4 compile (inline <style>, CDN script removed) → Lighthouse-friendly
        ↓
  [optional] PHP baker: data-edit zones → <?= e($c['id']) ?>, flat-file admin
        ↓
  Live preview + Download HTML / Download PHP (ZIP)
```

Why template-adaptation instead of from-scratch generation: 7B local models choke on writing a full React project with imports, components and configs. They do great at *adapting existing HTML*. That's the insight that makes this work on an RTX 3060.

---

## Quick start

### Prerequisites

- **Node.js 20+**
- **LM Studio** running locally — [lmstudio.ai](https://lmstudio.ai)
- Recommended model: **Qwen2.5-Coder-7B-Instruct** (Q4_K_M, ~4.5 GB)

### Install

```bash
git clone https://github.com/igor1000rr/nit-builder.git
cd nit-builder
npm install
cp .env.example .env
# edit .env — set LMSTUDIO_BASE_URL if not on the default port
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Set up LM Studio

1. Download [LM Studio](https://lmstudio.ai)
2. Pull `Qwen2.5-Coder-7B-Instruct` (Q4_K_M)
3. Developer → Start Server (default `http://localhost:1234`)
4. Verify `LMSTUDIO_BASE_URL=http://localhost:1234` in `.env`
5. `npm run dev` → describe a site → done in ~60s

👉 **For 8 GB GPUs:** see [LM Studio Optimization Guide](./docs/lm-studio-guide.md) — Flash Attention, KV cache quantization, VRAM math, when to enable YaRN.

### Hardware

| GPU | Recommended model | Speed | Quality |
|---|---|---|---|
| 4 GB VRAM | Qwen2.5-Coder-3B-Q4 | Slow | OK |
| **8 GB VRAM (RTX 3060/4060)** | **Qwen2.5-Coder-7B-Q4** | **Good** | **Great** ⭐ |
| 12+ GB VRAM | Qwen2.5-Coder-14B-Q4 | Fast | Excellent |

> **Heads-up:** v2 removed the Groq and OpenRouter cloud fallbacks that existed in v1. The product is now positioned as P2P — your prompts never leave your machine. If you absolutely need cloud inference, stay on v1 or contribute a provider plugin.

---

## 22 built-in templates

☕ Coffee shops · 💈 Barbershops · 📸 Photographers · 💻 Developer portfolios · 💒 Wedding invitations · 💪 Fitness trainers · 🍽️ Restaurants · 📚 Tutors · 💅 Beauty services · 🔧 Auto shops · 🎨 Handmade businesses · 🎧 DJs/Musicians · 🚀 SaaS landings · 🦷 Medical clinics · 🧘 Yoga studios · 🖤 Tattoo studios · 💐 Flower shops · 🗣️ Language schools · ⚖️ Law firms · 🎮 Indie game studios · 🏠 Real estate · 📄 Universal fallback

Catalog: [`app/lib/config/htmlTemplatesCatalog.ts`](./app/lib/config/htmlTemplatesCatalog.ts) · HTML files: [`app/templates/html/`](./app/templates/html/)

---

## Optional: PHP admin bundle

When the Planner decides a site needs editable content (`needs_admin=true`), the Coder marks editable nodes with `data-edit`/`data-edit-type`/`data-edit-label` attributes. A deterministic post-processor (`app/lib/bake/`) then bakes the HTML into PHP:

```html
<!-- before -->
<h1 data-edit="hero_title" data-edit-type="text">Best coffee in Minsk</h1>

<!-- after -->
<h1><?= e($c['hero_title'] ?? 'Best coffee in Minsk') ?></h1>
```

The ZIP bundle contains:

```
index.php             ← your site with PHP slots
admin/                ← login, dashboard, edit (text / richtext / image)
admin/lib/            ← auth, csrf, atomic JSON store
data/                 ← content.json + defaults.json + zones.json
setup.php             ← one-time admin creation, delete after first login
assets/uploads/       ← MIME-validated, .htaccess blocks .php execution
```

Pure PHP 8.1+, zero dependencies, no database. Argon2id passwords, CSRF tokens, rate-limit (5 attempts / 15 min), atomic writes via tempnam+rename. Deploys to any shared hosting.

---

## Tech stack

- **React Router v7** (SSR) + **React 19** + **TypeScript 5.7**
- **Tailwind CSS v4** via Vite plugin (compiled inline for generated sites)
- **Vercel AI SDK** (`ai@5` + `@ai-sdk/openai`) for streaming
- **Zod** for plan-schema validation
- **node-html-parser** for the HTML→PHP baker
- **ws** + **Tauri 2.0** for the tunnel
- **Argon2id** + HMAC-SHA256 for tunnel tokens, **session-version revocation** for cookies
- **Appwrite** for user storage, sites, and persistent guest-IP quotas
- **Vitest 3** — 74 test files, ~11k LOC of tests, CI green on every push

---

## Contributing

### Add a template

1. Create `app/templates/html/your-id.html` — single file, `<!DOCTYPE html>` to `</html>`, Tailwind via CDN inside the source, all images from Unsplash or inline SVG, responsive (`sm:`/`md:`/`lg:`)
2. Add metadata in `app/lib/config/htmlTemplatesCatalog.ts`
3. Open a PR with a screenshot

### Bugs & features

Open an issue using the templates in `.github/ISSUE_TEMPLATE/`. CI must stay green (`npm run lint && npm run typecheck && npm test && npm run build`).

---

## Roadmap

### Done

- [x] **v1.0** — HTML-first pipeline, 22 templates, LM Studio + cloud fallbacks
- [x] **v2.0-beta** — peer-to-peer WSS tunnel, Tauri desktop client (with tray
  icon / autostart / auto-update), multi-user auth via Appwrite, persistent
  guest IP quotas, PHP admin baker with `data-edit` zones, Tailwind v4 inline
  compile, RAG cascade (BM25 + dense + RRF + reranker), eval harness,
  CSPRNG-randomized `setup.php` filename (anti-race), cyberpunk UI redesign

### v2.1 — UX polish (next)

- [ ] Shareable preview links (`/p/<token>`) — public read-only URLs for
  generated sites, no download required
- [ ] "Save as Template" — promote your own successful generation into a
  personal (or community, via v2.2) template
- [ ] Continue-from-history — resume polish on a saved site instead of
  starting a fresh session
- [ ] Polish undo/redo — every iteration of the polish cascade kept and
  navigable
- [ ] Mobile UI — split layout doesn't work on narrow screens, needs a
  tab-switcher or drawer

### v2.2 — Community templates

- [ ] Template submission pipeline (review → publish), `nit_user_templates`
  collection in Appwrite
- [ ] Public gallery (`/templates`) with search, tags, preview
- [ ] Voting (👍/👎) and usage stats — fed into RAG as a weak signal for
  the Planner
- [ ] Forking — fetch someone else's template into your account and adapt it

### v2.3 — Image generation through the tunnel

- [ ] Stable Diffusion XL / Flux Schnell via the same WSS tunnel (new
  `tunnel:image_generate` message type)
- [ ] Tauri client auto-detects SD WebUI / ComfyUI / Flux locally just like
  it does LM Studio today
- [ ] Inline hero images instead of Unsplash placeholders — Planner suggests
  prompt, Coder marks `<img data-edit-gen="hero">`, post-processor renders
- [ ] "Regenerate image" button in the PHP admin — calls SD on the owner's
  tunnel, not the VPS

### v2.4 — Framework export

- [ ] Export to React + Vite (components per section, Tailwind config, ready
  `package.json`)
- [ ] Export to Vue 3 + Vite
- [ ] Export to Astro (cleanest fit for the current template-based architecture)
- [ ] Export to WordPress theme — reuse the PHP baker, add `style.css` header,
  `functions.php` and Customizer integration instead of the flat-file admin

### v2.5 — Backend artifact expansion

`phpSqliteArtifactBuilder` already provides a base (the 8abfe86 work).
Building on top:

- [ ] Contact forms — `POST /contact.php` with rate-limit and email notification
- [ ] Booking calendar — date-slot picker, SQLite-backed, no dependencies
- [ ] Multi-language (i18n) — `data-edit-lang="ru,en"` attribute, language
  switch via `?lang=` or Accept-Language

### v3.0 — Bundled LLM runtime (big one)

- [ ] Embed `llama.cpp` (via `llama-rs` or direct FFI) into the Tauri client.
  Tunnel protocol unchanged — the client picks the inference source:
  LM Studio (as today), bundled runtime, or external OpenAI-compatible endpoint
- [ ] Auto-download GGUF on first run (`Qwen2.5-Coder-7B-Q4_K_M`, ~4.5 GB)
  with progress bar
- [ ] Onboarding wizard — "first time? we'll pick a model for your GPU"

### v3.1 — Plugin marketplace

- [ ] Site-level plugins (analytics, chat widget, cookie banner, GA/GTM) —
  drop-in injection through the baker
- [ ] Theme-level plugins (extra sections: pricing table, testimonials slider,
  FAQ accordion) — extend the Planner schema
- [ ] Plugin API spec, manifest, signing

### Continuous (no version tag)

- RAG corpus growth: `planExamples` currently ~50, target 300+; weak
  signals from user feedback (see `feedbackIngest`)
- Eval harness: nightly regression matrix, public leaderboard, per-template
  quality scores
- UI i18n: Ukrainian, Polish, German — for regional small business
- More example prompts, video tutorials

---

## License

MIT © [Igor](https://t.me/igor1000rr) · Built in Belarus 🇧🇾

Part of the [VibeCoding](https://vibecoding.by) ecosystem.

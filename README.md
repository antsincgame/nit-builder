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
- **Vitest 3** — 69 test files, ~11k LOC of tests, CI green on every push

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

- [x] v1.0 — HTML-first pipeline, 22 templates, LM Studio + Groq + OpenRouter
- [x] v2.0-beta — peer-to-peer tunnel, Tauri desktop client, multi-user auth via Appwrite, persistent guest quotas, PHP admin baker, Tailwind inline compile
- [ ] v2.1 — "My Sites" page (CRUD UI), shareable preview links
- [ ] v2.2 — community template gallery, user-uploaded templates
- [ ] v2.3 — local image generation (Stable Diffusion via the tunnel)
- [ ] v2.4 — export to React / Vue / Astro
- [ ] v3.0 — bundled LLM runtime inside the Tauri client (no LM Studio dependency)

---

## License

MIT © [Igor](https://t.me/igor1000rr) · Built in Belarus 🇧🇾

Part of the [VibeCoding](https://vibecoding.by) ecosystem.

import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  // "/" — auth-aware splitter: guest → лендинг, authed → приложение
  index("routes/index.tsx"),
  // /about остаётся для прямых ссылок на лендинг
  route("about", "routes/landing.tsx"),
  // /app — приложение-генератор напрямую (для старых закладок / SSO-редиректов)
  route("app", "routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("register", "routes/register.tsx"),
  route("download", "routes/download.tsx"),
  // Legal — новый дизайн из nitgen-gront
  route("privacy", "routes/privacy.tsx"),
  route("terms", "routes/terms.tsx"),
  route("api/pipeline/simple", "routes/api.pipeline.simple.ts"),
  route("api/bundle", "routes/api.bundle.ts"),
  route("api/bundle/php", "routes/api.bundle.php.ts"),
  route("api/health", "routes/api.health.ts"),
  route("api/metrics", "routes/api.metrics.ts"),
  // Auth endpoints
  route("api/auth/register", "routes/api.auth.register.ts"),
  route("api/auth/login", "routes/api.auth.login.ts"),
  route("api/auth/logout", "routes/api.auth.logout.ts"),
  route("api/auth/logout-all", "routes/api.auth.logout-all.ts"),
  route("api/auth/me", "routes/api.auth.me.ts"),
  route("api/auth/regenerate-tunnel-token", "routes/api.auth.regenerate-tunnel-token.ts"),
  // Magic-link (passwordless)
  route("api/auth/request-magic-link", "routes/api.auth.request-magic-link.ts"),
  route("auth/verify", "routes/auth.verify.ts"),
  // Sites CRUD (Phase B.6)
  route("api/sites", "routes/api.sites.ts"),
  route("api/sites/:id", "routes/api.sites.$id.ts"),
  // Shareable preview links (v2.1)
  route("api/share", "routes/api.share.ts"),
  route("api/share/:id", "routes/api.share.$id.ts"),
  route("p/:token", "routes/p.$token.ts"),
  // User templates — Save as Template (v2.1)
  route("api/user-templates", "routes/api.user-templates.ts"),
  route("api/user-templates/:id", "routes/api.user-templates.$id.ts"),
  route("api/user-templates/:id/submit", "routes/api.user-templates.$id.submit.ts"),
  // Public templates — Community gallery (v2.2)
  route("api/public-templates", "routes/api.public-templates.ts"),
  route("api/public-templates/:id", "routes/api.public-templates.$id.ts"),
  route("api/public-templates/:id/vote", "routes/api.public-templates.$id.vote.ts"),
  // Public community gallery page (v2.2)
  route("templates", "routes/templates.tsx"),
  // Admin / RAG / Eval
  route("api/admin/eval/run", "routes/api.admin.eval.run.ts"),
  route("api/admin/feedback", "routes/api.admin.feedback.ts"),
  route("api/admin/metrics", "routes/api.admin.metrics.ts"),
  route("api/admin/guest-limits/cleanup", "routes/api.admin.guest-limits.cleanup.ts"),
  route("api/admin/rag/ingest", "routes/api.admin.rag.ingest.ts"),
  route("api/admin/rag/ingest-feedback", "routes/api.admin.rag.ingest-feedback.ts"),
  route("api/admin/rag/search", "routes/api.admin.rag.search.ts"),
  route("api/admin/rag/stats", "routes/api.admin.rag.stats.ts"),
  // Admin template moderation (v2.2)
  route("api/admin/templates/:id/approve", "routes/api.admin.templates.approve.$id.ts"),
  // Static assets
  route("sitemap.xml", "routes/sitemap[.xml].ts"),
  route("robots.txt", "routes/robots[.txt].ts"),
  route("*", "routes/$.tsx"),
] satisfies RouteConfig;

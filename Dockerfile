FROM node:20-alpine AS builder

WORKDIR /app

# Копируем ВСЕ package.json (root + workspace shared) ДО npm ci,
# чтобы npm правильно создал workspace symlinks между пакетами.
# tunnel/* исключён в .dockerignore — его package.json не нужен.
COPY package.json package-lock.json* ./
COPY shared/package.json ./shared/

# npm ci с workspaces подтянет зависимости для root и shared,
# и создаст симлинк node_modules/@nit/shared -> ../shared.
#
# --ignore-scripts СОЗНАТЕЛЬНО НЕ ставится — argon2 (native module,
# используется в tunnelTokens.server.ts) требует postinstall для подкачки
# prebuilt binary. Без этого require('argon2') падает на старте.
RUN npm ci

COPY . .

# Если у shared есть свой build script — собираем сначала его,
# чтобы @nit/shared отдавал готовые артефакты основному build.
RUN npm run shared:build --if-present
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

# curl нужен для HEALTHCHECK в Coolify; busybox wget в alpine не всегда
# нормально выводит код ответа. ca-certificates — на случай HTTPS-вызовов
# внутри приложения (Appwrite, OpenRouter и т.п.).
RUN apk add --no-cache curl ca-certificates

ENV NODE_ENV=production
ENV PORT=3000

# Снова копируем package.json для всех workspaces, иначе npm ci
# в prod-режиме не подцепит @nit/shared.
COPY --from=builder /app/package.json /app/package-lock.json* ./
COPY --from=builder /app/shared/package.json ./shared/

RUN npm ci --omit=dev && npm cache clean --force

# server.ts — entrypoint приложения, запускается через tsx в runtime.
# tsconfig.json + env.d.ts нужны tsx для resolve type-aware импортов.
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/env.d.ts ./

# Артефакты сборки и runtime-файлы
COPY --from=builder /app/build ./build
COPY --from=builder /app/public ./public
COPY --from=builder /app/app/templates ./app/templates
# shared/ нужен в runtime — на него ссылается symlink @nit/shared
COPY --from=builder /app/shared ./shared

EXPOSE 3000

# curl вместо wget. -f = fail на HTTP >= 400, -s = silent, -S = показать ошибку.
# start-period увеличен до 60s — tsx + argon2 + workspace setup иногда долго стартуют.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -fsS http://localhost:3000/api/health || exit 1

CMD ["npm", "start"]

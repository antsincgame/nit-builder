FROM node:20-alpine AS builder

WORKDIR /app

# Копируем ВСЕ package.json (root + workspace shared) ДО npm ci,
# чтобы npm правильно создал workspace symlinks между пакетами.
COPY package.json package-lock.json* ./
COPY shared/package.json ./shared/

# npm ci с workspaces подтянет зависимости для root и shared,
# создаст симлинк node_modules/@nit/shared -> ../shared
# и выполнит postinstall для argon2 (native module).
RUN npm ci

COPY . .

RUN npm run shared:build --if-present
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

# curl для HEALTHCHECK + ca-certificates для HTTPS-вызовов внутри приложения
RUN apk add --no-cache curl ca-certificates

ENV NODE_ENV=production
ENV PORT=3000

# Это ГИБРИДНЫЙ деплой: React Router бандл в build/, а HTTP+WS сервер (server.ts)
# крутится через tsx прямо из исходников (app/lib/server/* и т.п.).
# Поэтому в runner нужны практически все рабочие файлы из builder — проще всего
# перетащить весь /app одним слоем (включая node_modules с уже собранным argon2).
#
# .dockerignore уже исключил tunnel/, .git, tests и т.п. на стадии build context,
# поэтому /app в builder уже чистый.
COPY --from=builder /app .

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -fsS http://localhost:3000/api/health || exit 1

CMD ["npm", "start"]

FROM node:20-alpine AS builder
WORKDIR /app
# npm ci вместо npm install: воспроизводимый build по package-lock.json,
# без случайных minor-бампов во время docker build.
#
# --ignore-scripts СОЗНАТЕЛЬНО ИЛИН НЕ ставится здесь — argon2 (native module,
# используется в tunnelTokens.server.ts) требует postinstall для подкачки prebuilt
# binary или сборки из исходников. Без этого require('argon2') падает на старте.
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/package.json /app/package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/build ./build
COPY --from=builder /app/public ./public
COPY --from=builder /app/app/templates ./app/templates

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["npm", "start"]

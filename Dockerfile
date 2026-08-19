# ─────────────────────────── Сборка фронта ───────────────────────────
FROM node:24-alpine AS ui

WORKDIR /app/ui

# Зависимости отдельным слоем: пока package-lock.json не менялся,
# пересборка образа не переустанавливает их заново.
COPY ui/package.json ui/package-lock.json ./
RUN npm ci

COPY ui/ ./

# Пустой VITE_API_URL — фронт и API отдаются с одного origin, и запросы уходят
# относительными путями. Адрес бэкенда подставляется на этапе сборки, поэтому
# задавать его в рантайме поздно: он уже вшит в бандл.
ENV VITE_API_URL=""
RUN npm run build

# ─────────────────────────── Рантайм ───────────────────────────
FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production

# --omit=dev выбрасывает Vitest, Playwright, Prism и компилятор TypeSpec:
# в образе остаются только express, cors и pg.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server/ ./server/
COPY --from=ui /app/ui/dist ./ui/dist

# Не root: если процесс скомпрометируют, у него не будет прав на файловую систему образа.
USER node

# Информационно — реальный порт приходит из PORT (Render подставляет свой).
EXPOSE 3000

CMD ["node", "server/index.js"]

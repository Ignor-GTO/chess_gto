FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
# postinstall требует scripts/copy-stockfish.mjs — исходники копируем после npm ci
RUN npm ci --ignore-scripts

COPY . .
RUN npm run copy:stockfish \
    && test -s public/stockfish/stockfish.js \
    && test -s public/stockfish/stockfish.wasm
RUN npm run build \
    && test -s dist/stockfish/stockfish.wasm

# ── Production: Nginx для раздачи статики ──────────────────
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

# Конфиг для Vue Router history mode
COPY nginx-spa.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

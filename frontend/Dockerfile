FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Production: Nginx для раздачи статики ──────────────────
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

# Конфиг для Vue Router history mode
COPY nginx-spa.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

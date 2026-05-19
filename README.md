# Chess GTO

Онлайн-шахматная платформа [chess.gto-team.uz](https://chess.gto-team.uz): PvP, игра с ботом, post-game анализ Stockfish, рейтинг Glicko-2.

## Стек

- **Backend:** Django 4.2, Channels, Celery, PostgreSQL, Redis
- **Frontend:** Vue 3, Pinia, Vite, Stockfish WASM
- **Deploy:** Docker Compose (Dokploy)

## Быстрый старт (локально)

### 1. Переменные окружения

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
```

### 2. Docker (локально)

На сервере Dokploy порты 80/443 заняты Traefik — см. раздел **Dokploy** ниже.

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
```

Откройте http://localhost:8080

### 3. Разработка без Docker

**Backend** (нужны PostgreSQL + Redis):

```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
daphne -b 0.0.0.0 -p 8000 config.asgi:application
```

**Celery** (отдельный терминал):

```bash
cd backend
celery -A config worker -l info
celery -A config beat -l info
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

Откройте http://localhost:5173

## Dokploy

1. Создайте Compose-приложение из репозитория, путь `./docker-compose.yml`.
2. Заполните `.env` по `.env.example`.
3. В **Domains** добавьте домен `chess.gto-team.uz`:
   - **Рекомендуется:** сервис **nginx**, порт **80**
   - **Или:** сервис **frontend**, порт **80** (API проксируется в nginx-spa.conf)
4. Deploy — SSL делает Traefik Dokploy.

> **405 на `/api/auth/token/`** — домен смотрит на frontend без прокси API. Пересоберите frontend или переключите домен на сервис **nginx**.

## Graphify (база знаний)

```bash
python -m graphify antigravity install   # или: graphify cursor install
python -m graphify update .
python -m graphify watch .
```

## API

| Endpoint | Описание |
|----------|----------|
| `POST /api/auth/register/` | Регистрация |
| `POST /api/auth/token/` | JWT login |
| `POST /api/games/` | Лобби / matchmaking |
| `WS /ws/game/<id>/` | Real-time игра |
| `WS /ws/presence/` | Онлайн-счётчик |
| `POST /api/games/bot/create/` | Партия vs бот |

## Структура

```
backend/     Django + Channels + Celery
frontend/    Vue 3 SPA + Capacitor
nginx/       Reverse proxy (HTTP за Traefik)
graphify-out/ Knowledge graph (graphify)
```

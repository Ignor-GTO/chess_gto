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

### 2. Docker (рекомендуется)

```bash
docker compose up -d --build
```

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
nginx/       Reverse proxy + SSL
graphify-out/ Knowledge graph (graphify)
```

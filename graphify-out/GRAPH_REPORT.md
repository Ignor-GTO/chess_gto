# Graph Report - chess_gto  (2026-05-19)

## Corpus Check
- 66 files · ~21,870 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 462 nodes · 520 edges · 69 communities (39 shown, 30 thin omitted)
- Extraction: 86% EXTRACTED · 14% INFERRED · 0% AMBIGUOUS · INFERRED: 71 edges (avg confidence: 0.53)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]

## God Nodes (most connected - your core abstractions)
1. `GameConsumer` - 21 edges
2. `Game` - 19 edges
3. `Move` - 15 edges
4. `BotGame` - 12 edges
5. `GameViewSet` - 11 edges
6. `scripts` - 11 edges
7. `UserAdmin` - 10 edges
8. `RegisterSerializer` - 9 edges
9. `UserMeView` - 9 edges
10. `OnlineCountView` - 9 edges

## Surprising Connections (you probably didn't know these)
- `BotGameSerializer` --uses--> `BotGame`  [INFERRED]
  backend/apps/games/bot_views.py → backend/apps/games/bot_models.py
- `BotGameListView` --uses--> `BotGame`  [INFERRED]
  backend/apps/games/bot_views.py → backend/apps/games/bot_models.py
- `BotGameDetailView` --uses--> `BotGame`  [INFERRED]
  backend/apps/games/bot_views.py → backend/apps/games/bot_models.py
- `BotGameCreateView` --uses--> `BotGame`  [INFERRED]
  backend/apps/games/bot_views.py → backend/apps/games/bot_models.py
- `BotGameUpdateView` --uses--> `BotGame`  [INFERRED]
  backend/apps/games/bot_views.py → backend/apps/games/bot_models.py

## Communities (69 total, 30 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.09
Nodes (36): GameDetailSerializer, GameSerializer, Meta, MoveSerializer, DRF Serializers для API., Сериализатор регистрации., Публичный профиль пользователя., Расширенный профиль (для /me/). (+28 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (35): check_game_over(), flag_cheating(), GameConsumer, get_game(), is_my_turn(), is_player(), is_white_player(), GameConsumer — WebSocket обработчик игры.  Поток:   1. Клиент подключается: ws:/ (+27 more)

### Community 2 - "Community 2"
Cohesion: 0.10
Nodes (20): devDependencies, autoprefixer, @capacitor/cli, tailwindcss, vite, @vitejs/plugin-vue, name, private (+12 more)

### Community 3 - "Community 3"
Cohesion: 0.09
Nodes (24): boardRef, chess, confirmPromotion(), draggedFrom, emit, files, getPiece(), hoveredSquare (+16 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (27): APIView, Meta, Модель партии против бота (хранится в БД для истории и анализа)., Result, Status, OnlineCountView, URL маршруты для bot games и online count., GET /api/users/online-count/ — количество онлайн пользователей. (+19 more)

### Community 5 - "Community 5"
Cohesion: 0.18
Nodes (9): canvasRef, canvasWidth, drawGraph(), emit, LABELS, onCanvasClick(), props, tooltip (+1 more)

### Community 6 - "Community 6"
Cohesion: 0.15
Nodes (9): authStore, botClock, botName, botRating, game, playerClock, route, router (+1 more)

### Community 7 - "Community 7"
Cohesion: 0.15
Nodes (16): calculate_glicko2_ratings(), _compute_new_rating(), _E(), _from_glicko2_scale(), _g(), Celery задача: расчёт рейтинга Glicko-2 после партии.  Алгоритм Glicko-2:   - Ка, Celery задача: рассчитать и сохранить новые Glicko-2 рейтинги.     Запускается п, Конвертируем из Glicko-1 шкалы в Glicko-2. (+8 more)

### Community 8 - "Community 8"
Cohesion: 0.20
Nodes (7): i18n, messages, app, pinia, router, routes, token

### Community 9 - "Community 9"
Cohesion: 0.09
Nodes (20): dependencies, axios, @capacitor/app, @capacitor-community/text-to-speech, @capacitor/core, chess.js, pinia, stockfish (+12 more)

### Community 10 - "Community 10"
Cohesion: 0.22
Nodes (9): authStore, errors, form, handleLogin(), loading, router, serverError, showPwd (+1 more)

### Community 11 - "Community 11"
Cohesion: 0.22
Nodes (8): isDraw, isWin, props, ratingChangeClass, reasonLabel, resultIcon, resultTitle, { t }

### Community 12 - "Community 12"
Cohesion: 0.29
Nodes (3): calcAccuracy(), handleWorkerMessage(), LABELS

### Community 13 - "Community 13"
Cohesion: 0.29
Nodes (6): BaseMiddleware, get_user_from_token(), JWTAuthMiddleware, JWT Auth Middleware для Django Channels WebSocket.  Аутентифицирует пользователя, Извлекаем пользователя из JWT токена., Middleware: извлекает JWT из query string и аутентифицирует пользователя.     Кл

### Community 14 - "Community 14"
Cohesion: 0.25
Nodes (7): Meta, MoveClassification, Модели партий: Game и Move, Классификация ходов (как у Chess.com), Result, Status, TimeControl

### Community 15 - "Community 15"
Cohesion: 0.25
Nodes (5): AbstractUser, Meta, Модели: User с рейтингом Glicko-2, Кастомная модель пользователя с Glicko-2 рейтингом.     Glicko-2 использует три, User

### Community 16 - "Community 16"
Cohesion: 0.33
Nodes (4): failedQueue, instance, refresh, token

### Community 17 - "Community 17"
Cohesion: 0.29
Nodes (3): myClock, myRatingChange, opponentClock

### Community 18 - "Community 18"
Cohesion: 0.40
Nodes (5): check_game_timeouts(), _end_by_timeout(), Celery задача: отслеживание таймаута шахматных часов.  Проверяет активные партии, Периодическая задача (каждые 10с).     Проверяет все активные партии на превышен, Завершает партию поражением по времени.

### Community 21 - "Community 21"
Cohesion: 0.50
Nodes (3): from, move, to

### Community 24 - "Community 24"
Cohesion: 0.18
Nodes (10): bin, candidates, chunks, dest, jsSrc, projectRoot, root, wasmCandidates (+2 more)

### Community 42 - "Community 42"
Cohesion: 0.29
Nodes (4): AnalysisConfig, AppConfig, GamesConfig, UsersConfig

### Community 53 - "Community 53"
Cohesion: 0.22
Nodes (9): AsyncWebsocketConsumer, PresenceConsumer, WebSocket consumer for online presence (lobby counter)., ws/presence/ — heartbeat для счётчика онлайн игроков., Online presence tracking via Redis cache., _refresh_online_count(), set_user_online(), user_connected() (+1 more)

### Community 61 - "Community 61"
Cohesion: 0.12
Nodes (16): 1. Переменные окружения, 2. Docker (рекомендуется), 3. Разработка без Docker, API, Chess GTO, code:bash (cp .env.example .env), code:bash (docker compose up -d --build), code:bash (cd backend) (+8 more)

## Knowledge Gaps
- **125 isolated node(s):** `Result`, `Status`, `Meta`, `TimeControl`, `Status` (+120 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **30 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `GameConsumer` connect `Community 1` to `Community 0`, `Community 4`, `Community 53`?**
  _High betweenness centrality (0.071) - this node is a cross-community bridge._
- **Why does `Game` connect `Community 0` to `Community 1`, `Community 14`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Why does `BotGame` connect `Community 0` to `Community 4`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `GameConsumer` (e.g. with `Game` and `Move`) actually correct?**
  _`GameConsumer` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 16 inferred relationships involving `Game` (e.g. with `RegisterSerializer` and `Meta`) actually correct?**
  _`Game` has 16 INFERRED edges - model-reasoned connections that need verification._
- **Are the 12 inferred relationships involving `Move` (e.g. with `RegisterSerializer` and `Meta`) actually correct?**
  _`Move` has 12 INFERRED edges - model-reasoned connections that need verification._
- **Are the 9 inferred relationships involving `BotGame` (e.g. with `UserAdmin` and `MoveInline`) actually correct?**
  _`BotGame` has 9 INFERRED edges - model-reasoned connections that need verification._
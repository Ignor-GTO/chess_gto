"""
GameConsumer — WebSocket обработчик игры.

Поток:
  1. Клиент подключается: ws://host/ws/game/<game_id>/
  2. JWTAuthMiddleware аутентифицирует пользователя
  3. receive() принимает ходы, валидирует через python-chess
  4. Рассылает обновление обоим игрокам через channel group
"""
import json
import time
import logging
import chess
import chess.pgn

from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone

logger = logging.getLogger(__name__)


class GameConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        """Подключение к WebSocket."""
        self.game_id = self.scope['url_route']['kwargs']['game_id']
        self.room_group_name = f'game_{self.game_id}'
        self.user = self.scope.get('user')

        # Проверяем аутентификацию
        if not self.user or not self.user.is_authenticated:
            await self.close(code=4001)
            return

        # Загружаем партию и проверяем, что пользователь — участник
        self.game = await self.get_game()
        if not self.game:
            await self.close(code=4004)
            return

        if not await self.is_player():
            await self.close(code=4003)
            return

        # Вступаем в группу каналов
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

        # Восстанавливаем доску из FEN
        self.board = chess.Board(self.game.current_fen)

        # Уведомляем группу о подключении
        await self.channel_layer.group_send(self.room_group_name, {
            'type': 'player_connected',
            'user_id': str(self.user.id),
            'username': self.user.username,
        })

        started = await self.register_connection()
        if started:
            await self.channel_layer.group_send(self.room_group_name, {
                'type': 'game_started',
                'white_clock': int(self.game.white_time_remaining * 1000),
                'black_clock': int(self.game.black_time_remaining * 1000),
                'fen': self.game.current_fen,
            })
        elif self.game.status == 'active':
            game = await self.refresh_game_state()
            if game:
                await self.send(json.dumps({
                    'type': 'game_sync',
                    'fen': game.current_fen,
                    'white_clock': int(game.white_time_remaining * 1000),
                    'black_clock': int(game.black_time_remaining * 1000),
                }))

        logger.info(f'User {self.user.username} connected to game {self.game_id}')

    async def disconnect(self, close_code):
        """Отключение от WebSocket."""
        if hasattr(self, 'room_group_name'):
            await self.unregister_connection()
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)
        logger.info(f'User disconnected from game {self.game_id}, code={close_code}')

    async def receive(self, text_data):
        """
        Получение сообщения от клиента.
        Формат: {"type": "move", "uci": "e2e4", "timestamp": 1234567890}
        """
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            await self.send_error('invalid_json')
            return

        msg_type = data.get('type')

        if msg_type == 'move':
            await self.handle_move(data)
        elif msg_type == 'resign':
            await self.handle_resign()
        elif msg_type == 'draw_offer':
            await self.handle_draw_offer()
        elif msg_type == 'draw_accept':
            await self.handle_draw_accept()
        elif msg_type == 'draw_reject':
            await self.handle_draw_reject()
        elif msg_type == 'ping':
            # Для поддержки соединения
            await self.send(json.dumps({'type': 'pong'}))

    async def handle_move(self, data):
        """
        Обработка хода. Вся валидация на сервере через python-chess.
        """
        await self.refresh_board_from_db()

        uci_move = data.get('uci', '')
        client_timestamp = data.get('timestamp', time.time() * 1000)

        # 1. Проверяем очередь хода
        if not await self.is_my_turn():
            await self.send_error('not_your_turn')
            return

        # 2. Парсим и валидируем ход
        try:
            move = chess.Move.from_uci(uci_move)
        except chess.InvalidMoveError:
            await self.send_error('invalid_move_format')
            return

        if move not in self.board.legal_moves:
            # ЧИТЕРСТВО — невозможный ход
            logger.warning(
                f'CHEAT DETECTED: user={self.user.username}, '
                f'game={self.game_id}, move={uci_move}'
            )
            await self.flag_cheating()
            await self.close(code=4008)
            return

        # 3. Вычисляем SAN до применения хода
        san = self.board.san(move)

        # 4. Lag compensation: вычисляем реальное время хода
        server_timestamp = time.time() * 1000
        lag_ms = max(0, server_timestamp - client_timestamp)
        # Ограничиваем компенсацию (не более 500мс)
        compensation_ms = min(lag_ms, 500)

        # 5. Применяем ход
        self.board.push(move)
        move_number = self.board.fullmove_number
        is_white_move = not self.board.turn  # после push() turn меняется

        # 6. Обновляем часы и сохраняем ход в БД
        clock_data = await self.save_move_and_update_clock(
            uci=uci_move,
            san=san,
            fen_after=self.board.fen(),
            move_number=move_number,
            is_white_move=is_white_move,
            compensation_ms=compensation_ms,
        )

        # 7. Проверяем конец партии
        game_over = await self.check_game_over()

        # 8. Рассылаем ход обоим игрокам
        move_payload = {
            'uci': uci_move,
            'san': san,
            'fen': self.board.fen(),
            'move_number': move_number,
            'white_clock': clock_data['white_clock'],
            'black_clock': clock_data['black_clock'],
            'game_over': game_over,
        }

        # Прямой ответ инициатору (на случай проблем с group broadcast)
        await self.send(json.dumps({'type': 'move', **move_payload}))

        await self.channel_layer.group_send(self.room_group_name, {
            'type': 'move_made',
            **move_payload,
        })

    async def handle_resign(self):
        """Сдача партии."""
        is_white = await self.is_white_player()
        result = 'black_win' if is_white else 'white_win'
        await self.finish_game(result=result, reason='resign')
        await self.channel_layer.group_send(self.room_group_name, {
            'type': 'game_ended',
            'result': result,
            'reason': 'resign',
        })

    async def handle_draw_offer(self):
        """Предложение ничьей."""
        await self.channel_layer.group_send(self.room_group_name, {
            'type': 'draw_offered',
            'from_user': str(self.user.id),
        })

    async def handle_draw_accept(self):
        """Принятие ничьей."""
        await self.finish_game(result='draw', reason='draw_agreement')
        await self.channel_layer.group_send(self.room_group_name, {
            'type': 'game_ended',
            'result': 'draw',
            'reason': 'draw_agreement',
        })

    async def handle_draw_reject(self):
        """Отклонение предложения ничьей."""
        await self.channel_layer.group_send(self.room_group_name, {
            'type': 'draw_rejected',
            'from_user': str(self.user.id),
        })

    # --- Channel layer event handlers (рассылка группе) ---

    async def move_made(self, event):
        """Отправка хода всем в группе + синхронизация локальной доски."""
        self.board = chess.Board(event['fen'])
        payload = {k: v for k, v in event.items() if k != 'type'}
        await self.send(json.dumps({
            'type': 'move',
            **payload,
        }))

    async def game_ended(self, event):
        """Уведомление об окончании партии."""
        await self.send(json.dumps({
            'type': 'game_over',
            'result': event['result'],
            'reason': event['reason'],
        }))

    async def player_connected(self, event):
        """Уведомление о подключении игрока."""
        await self.send(json.dumps({
            'type': 'player_connected',
            'username': event['username'],
        }))

    async def draw_offered(self, event):
        """Уведомление о предложении ничьей."""
        await self.send(json.dumps({'type': 'draw_offer'}))

    async def draw_rejected(self, event):
        await self.send(json.dumps({'type': 'draw_rejected'}))

    async def game_started(self, event):
        """Оба игрока подключены — партия началась."""
        await self.send(json.dumps({
            'type': 'game_started',
            'white_clock': event['white_clock'],
            'black_clock': event['black_clock'],
            'fen': event['fen'],
        }))

    # --- Вспомогательные методы ---

    async def send_error(self, code: str):
        await self.send(json.dumps({'type': 'error', 'code': code}))

    @database_sync_to_async
    def refresh_board_from_db(self):
        """Актуальная позиция из БД перед обработкой хода."""
        from apps.games.models import Game
        self.game = Game.objects.get(id=self.game_id)
        self.board = chess.Board(self.game.current_fen)

    @database_sync_to_async
    def refresh_game_state(self):
        from apps.games.models import Game
        try:
            return Game.objects.get(id=self.game_id, status='active')
        except Game.DoesNotExist:
            return None

    @database_sync_to_async
    def get_game(self):
        from apps.games.models import Game
        try:
            return Game.objects.select_related('white_player', 'black_player').get(
                id=self.game_id,
                status__in=['waiting', 'active']
            )
        except Game.DoesNotExist:
            return None

    @database_sync_to_async
    def is_player(self):
        return (
            self.game.white_player_id == self.user.id or
            self.game.black_player_id == self.user.id
        )

    @database_sync_to_async
    def is_my_turn(self):
        """Проверяет, чья очередь ходить."""
        white_to_move = self.board.turn == chess.WHITE
        is_white = self.game.white_player_id == self.user.id
        return (white_to_move and is_white) or (not white_to_move and not is_white)

    @database_sync_to_async
    def is_white_player(self):
        return self.game.white_player_id == self.user.id

    @database_sync_to_async
    def save_move_and_update_clock(self, uci, san, fen_after, move_number,
                                    is_white_move, compensation_ms):
        """
        Сохраняет ход в БД и обновляет шахматные часы.
        Lag compensation: вычитаем задержку из потраченного времени.
        """
        from apps.games.models import Game, Move
        from django.utils import timezone

        now = timezone.now()
        game = Game.objects.select_for_update().get(id=self.game_id)

        # Вычисляем время, потраченное на ход
        reference_time = game.last_move_at or game.started_at
        if reference_time:
            elapsed_ms = (now - reference_time).total_seconds() * 1000
            actual_spent_ms = max(0, elapsed_ms - compensation_ms)
        else:
            actual_spent_ms = 0

        if game.status != 'active':
            game.status = 'active'
            if not game.started_at:
                game.started_at = now

        # Обновляем часы
        if is_white_move:
            game.white_time_remaining = max(
                0, game.white_time_remaining - actual_spent_ms / 1000
            )
            game.white_time_remaining += game.increment
            clock_ms = int(game.white_time_remaining * 1000)
        else:
            game.black_time_remaining = max(
                0, game.black_time_remaining - actual_spent_ms / 1000
            )
            game.black_time_remaining += game.increment
            clock_ms = int(game.black_time_remaining * 1000)

        game.current_fen = fen_after
        game.last_move_at = now

        # Обновляем PGN
        if not game.pgn:
            game.pgn = ''
        game.pgn += f' {san}'

        game.save(update_fields=[
            'status', 'started_at', 'current_fen', 'last_move_at',
            'white_time_remaining', 'black_time_remaining', 'pgn'
        ])

        # Сохраняем ход (ply = количество полуходов)
        ply = len(self.board.move_stack)
        Move.objects.create(
            game_id=self.game_id,
            player=self.user,
            move_number=ply,
            uci=uci,
            san=san,
            fen_after=fen_after,
            time_spent_ms=int(actual_spent_ms),
            clock_ms=clock_ms,
        )

        return {
            'white_clock': int(game.white_time_remaining * 1000),
            'black_clock': int(game.black_time_remaining * 1000),
        }

    @database_sync_to_async
    def check_game_over(self):
        """Проверяет конец партии и запускает расчёт рейтинга."""
        from apps.games.models import Game
        from apps.games.tasks import calculate_glicko2_ratings

        if self.board.is_checkmate():
            winner_is_white = self.board.turn == chess.BLACK
            result = 'white_win' if winner_is_white else 'black_win'
            self._finish_game_sync(result, 'checkmate')
            calculate_glicko2_ratings.delay(str(self.game_id))
            return {'result': result, 'reason': 'checkmate'}

        if self.board.is_stalemate():
            self._finish_game_sync('draw', 'stalemate')
            calculate_glicko2_ratings.delay(str(self.game_id))
            return {'result': 'draw', 'reason': 'stalemate'}

        if self.board.is_insufficient_material():
            self._finish_game_sync('draw', 'insufficient_material')
            calculate_glicko2_ratings.delay(str(self.game_id))
            return {'result': 'draw', 'reason': 'insufficient_material'}

        if self.board.is_seventyfive_moves():
            self._finish_game_sync('draw', '75_moves')
            calculate_glicko2_ratings.delay(str(self.game_id))
            return {'result': 'draw', 'reason': '75_moves'}

        if self.board.can_claim_fifty_moves():
            self._finish_game_sync('draw', '50_moves')
            calculate_glicko2_ratings.delay(str(self.game_id))
            return {'result': 'draw', 'reason': '50_moves'}

        if self.board.can_claim_threefold_repetition():
            self._finish_game_sync('draw', 'threefold_repetition')
            calculate_glicko2_ratings.delay(str(self.game_id))
            return {'result': 'draw', 'reason': 'threefold_repetition'}

        return None

    def _finish_game_sync(self, result, reason):
        """Синхронное завершение партии (вызывается внутри database_sync_to_async)."""
        from apps.games.models import Game
        from django.utils import timezone
        Game.objects.filter(id=self.game_id).update(
            status='finished',
            result=result,
            result_reason=reason,
            finished_at=timezone.now(),
        )

    async def finish_game(self, result, reason):
        """Асинхронная обёртка для завершения партии."""
        await database_sync_to_async(self._finish_game_sync)(result, reason)
        from apps.games.tasks import calculate_glicko2_ratings
        calculate_glicko2_ratings.delay(str(self.game_id))

    @database_sync_to_async
    def register_connection(self):
        """Регистрирует WS-подключение; стартует партию когда оба игрока онлайн."""
        from django.core.cache import cache
        from apps.games.models import Game
        from django.utils import timezone
        from django.db import transaction

        key = f'game_{self.game_id}_connected'
        connected = set(cache.get(key) or [])
        connected.add(str(self.user.id))
        cache.set(key, list(connected), timeout=3600)

        with transaction.atomic():
            game = Game.objects.select_for_update().get(id=self.game_id)
            player_ids = {str(game.white_player_id), str(game.black_player_id)}
            player_ids.discard('None')

            if len(connected & player_ids) < 2 or len(player_ids) < 2:
                return False

            if game.status == 'waiting':
                now = timezone.now()
                game.status = 'active'
                game.started_at = now
                game.last_move_at = now
                game.save(update_fields=['status', 'started_at', 'last_move_at'])
                self.game = game
                return True

        return False

    @database_sync_to_async
    def unregister_connection(self):
        from django.core.cache import cache
        key = f'game_{self.game_id}_connected'
        connected = set(cache.get(key) or [])
        connected.discard(str(self.user.id))
        cache.set(key, list(connected), timeout=3600)

    @database_sync_to_async
    def flag_cheating(self):
        """Помечает партию как читерскую."""
        from apps.games.models import Game
        Game.objects.filter(id=self.game_id).update(
            status='cheating',
            result_reason='illegal_move',
        )

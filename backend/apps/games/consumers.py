"""
GameConsumer — WebSocket обработчик игры.

Поток:
  1. Клиент подключается: ws://host/ws/game/<game_id>/
  2. JWTAuthMiddleware аутентифицирует пользователя
  3. На connect сервер шлёт текущее состояние (game_sync) клиенту.
     Если оба игрока online — рассылает game_started всем.
  4. receive() принимает ходы, валидирует через python-chess.
  5. Рассылает обновление обоим игрокам через channel group.
"""
import json
import time
import logging

import chess
import redis

from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


def _redis_client():
    """Прямой Redis-клиент для атомарных операций (SADD/SMEMBERS/SREM)."""
    return redis.from_url(settings.REDIS_URL, decode_responses=True)


class GameConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        self.game_id = self.scope['url_route']['kwargs']['game_id']
        self.room_group_name = f'game_{self.game_id}'
        self.user = self.scope.get('user')

        if not self.user or not self.user.is_authenticated:
            await self.close(code=4001)
            return

        self.game = await self.get_game()
        if not self.game:
            await self.close(code=4004)
            return

        if not await self.is_player():
            await self.close(code=4003)
            return

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

        self.board = chess.Board(self.game.current_fen)

        await self.channel_layer.group_send(self.room_group_name, {
            'type': 'player_connected',
            'user_id': str(self.user.id),
            'username': self.user.username,
        })

        # Регистрируем подключение и решаем, активировать ли партию
        started = await self.register_connection()
        snapshot = await self.build_sync_payload()

        if snapshot is None:
            logger.warning('Game %s disappeared during connect', self.game_id)
            return

        if started:
            # Партия только что стартовала (waiting → active) — рассылаем всем
            await self.channel_layer.group_send(self.room_group_name, {
                'type': 'game_started',
                **snapshot,
            })
        else:
            # Просто отправляем текущее состояние ТОЛЬКО подключившемуся
            await self.send(json.dumps({
                'type': 'game_sync',
                **snapshot,
            }))

        logger.info('User %s connected to game %s (started=%s)',
                    self.user.username, self.game_id, started)

    async def disconnect(self, close_code):
        if hasattr(self, 'room_group_name'):
            await self.unregister_connection()
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)
        logger.info('User disconnected from game %s, code=%s', getattr(self, 'game_id', '?'), close_code)

    async def receive(self, text_data):
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
        elif msg_type == 'sync':
            snapshot = await self.build_sync_payload()
            if snapshot is not None:
                await self.send(json.dumps({'type': 'game_sync', **snapshot}))
        elif msg_type == 'ping':
            await self.send(json.dumps({'type': 'pong'}))

    async def handle_move(self, data):
        """Обработка хода. Вся валидация на сервере через python-chess."""
        await self.refresh_board_from_db()

        # Запрещаем ход если соперника нет
        if not self.game.black_player_id or not self.game.white_player_id:
            await self.send_error('waiting_for_opponent')
            return

        if self.game.status == 'finished':
            await self.send_error('game_finished')
            return

        uci_move = data.get('uci', '')
        client_timestamp = data.get('timestamp', time.time() * 1000)

        # 1. Проверяем очередь хода
        if not await self.is_my_turn():
            await self.send_error('not_your_turn')
            return

        # 2. Парсим и валидируем
        try:
            move = chess.Move.from_uci(uci_move)
        except chess.InvalidMoveError:
            await self.send_error('invalid_move_format')
            return

        if move not in self.board.legal_moves:
            logger.warning('CHEAT: user=%s game=%s move=%s', self.user.username, self.game_id, uci_move)
            await self.flag_cheating()
            await self.close(code=4008)
            return

        san = self.board.san(move)

        # 3. Lag compensation
        server_timestamp = time.time() * 1000
        lag_ms = max(0, server_timestamp - client_timestamp)
        compensation_ms = min(lag_ms, 500)

        # 4. Применяем ход
        self.board.push(move)
        move_number = self.board.fullmove_number
        is_white_move = not self.board.turn

        # 5. Сохраняем + часы (атомарно в транзакции)
        clock_data = await self.save_move_and_update_clock(
            uci=uci_move,
            san=san,
            fen_after=self.board.fen(),
            move_number=move_number,
            is_white_move=is_white_move,
            compensation_ms=compensation_ms,
        )

        # 6. Конец партии?
        game_over = await self.check_game_over()

        # 7. Рассылка
        move_payload = {
            'uci': uci_move,
            'san': san,
            'fen': self.board.fen(),
            'move_number': move_number,
            'ply': len(self.board.move_stack),
            'white_clock': clock_data['white_clock'],
            'black_clock': clock_data['black_clock'],
            'game_over': game_over,
        }

        await self.channel_layer.group_send(self.room_group_name, {
            'type': 'move_made',
            **move_payload,
        })

    async def handle_resign(self):
        is_white = await self.is_white_player()
        result = 'black_win' if is_white else 'white_win'
        await self.finish_game(result=result, reason='resign')
        await self.channel_layer.group_send(self.room_group_name, {
            'type': 'game_ended',
            'result': result,
            'reason': 'resign',
        })

    async def handle_draw_offer(self):
        await self.channel_layer.group_send(self.room_group_name, {
            'type': 'draw_offered',
            'from_user': str(self.user.id),
        })

    async def handle_draw_accept(self):
        await self.finish_game(result='draw', reason='draw_agreement')
        await self.channel_layer.group_send(self.room_group_name, {
            'type': 'game_ended',
            'result': 'draw',
            'reason': 'draw_agreement',
        })

    async def handle_draw_reject(self):
        await self.channel_layer.group_send(self.room_group_name, {
            'type': 'draw_rejected',
            'from_user': str(self.user.id),
        })

    # --- Channel layer event handlers (рассылка группе) ---

    async def move_made(self, event):
        """Получили ход через группу — синхронизируем локальную доску и отправляем клиенту."""
        try:
            self.board = chess.Board(event['fen'])
        except Exception:
            logger.exception('Invalid FEN in move_made: %s', event.get('fen'))
        payload = {k: v for k, v in event.items() if k != 'type'}
        await self.send(json.dumps({
            'type': 'move',
            **payload,
        }))

    async def game_ended(self, event):
        await self.send(json.dumps({
            'type': 'game_over',
            'result': event['result'],
            'reason': event['reason'],
        }))

    async def player_connected(self, event):
        await self.send(json.dumps({
            'type': 'player_connected',
            'username': event['username'],
        }))

    async def draw_offered(self, event):
        await self.send(json.dumps({'type': 'draw_offer'}))

    async def draw_rejected(self, event):
        await self.send(json.dumps({'type': 'draw_rejected'}))

    async def game_started(self, event):
        """Оба игрока подключены — партия началась (рассылка всем в группе)."""
        payload = {k: v for k, v in event.items() if k != 'type'}
        await self.send(json.dumps({
            'type': 'game_started',
            **payload,
        }))

    # --- Вспомогательные методы ---

    async def send_error(self, code: str):
        await self.send(json.dumps({'type': 'error', 'code': code}))

    @database_sync_to_async
    def refresh_board_from_db(self):
        from apps.games.models import Game
        self.game = Game.objects.get(id=self.game_id)
        self.board = chess.Board(self.game.current_fen)

    @database_sync_to_async
    def build_sync_payload(self):
        """Полное актуальное состояние партии (FEN, часы, ходы, статус)."""
        from apps.games.models import Game
        try:
            game = Game.objects.prefetch_related('moves').get(id=self.game_id)
        except Game.DoesNotExist:
            return None

        moves = [
            {
                'uci': m.uci,
                'san': m.san,
                'fen': m.fen_after,
                'move_number': m.move_number,
            }
            for m in game.moves.order_by('move_number')
        ]

        try:
            ply = chess.Board(game.current_fen).ply()
        except Exception:
            ply = len(moves)

        return {
            'fen': game.current_fen,
            'white_clock': int(game.white_time_remaining * 1000),
            'black_clock': int(game.black_time_remaining * 1000),
            'status': game.status,
            'moves': moves,
            'ply': ply,
        }

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
        white_to_move = self.board.turn == chess.WHITE
        is_white = self.game.white_player_id == self.user.id
        return (white_to_move and is_white) or (not white_to_move and not is_white)

    @database_sync_to_async
    def is_white_player(self):
        return self.game.white_player_id == self.user.id

    @database_sync_to_async
    def save_move_and_update_clock(self, uci, san, fen_after, move_number,
                                    is_white_move, compensation_ms):
        from apps.games.models import Game, Move
        from django.db import transaction

        now = timezone.now()

        with transaction.atomic():
            game = Game.objects.select_for_update().get(id=self.game_id)

            reference_time = game.last_move_at or game.started_at or now
            elapsed_ms = (now - reference_time).total_seconds() * 1000
            actual_spent_ms = max(0, elapsed_ms - compensation_ms)

            if game.status != 'active':
                game.status = 'active'
                if not game.started_at:
                    game.started_at = now

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

            if not game.pgn:
                game.pgn = ''
            game.pgn += f' {san}'

            game.save(update_fields=[
                'status', 'started_at', 'current_fen', 'last_move_at',
                'white_time_remaining', 'black_time_remaining', 'pgn'
            ])

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
        from apps.games.models import Game
        Game.objects.filter(id=self.game_id).update(
            status='finished',
            result=result,
            result_reason=reason,
            finished_at=timezone.now(),
        )

    async def finish_game(self, result, reason):
        await database_sync_to_async(self._finish_game_sync)(result, reason)
        from apps.games.tasks import calculate_glicko2_ratings
        calculate_glicko2_ratings.delay(str(self.game_id))

    @database_sync_to_async
    def register_connection(self):
        """
        Атомарно регистрирует подключение через Redis SADD.
        Возвращает True ТОЛЬКО при переходе waiting → active.
        """
        from apps.games.models import Game
        from django.db import transaction

        key = f'game_{self.game_id}_connected'

        try:
            r = _redis_client()
            r.sadd(key, str(self.user.id))
            r.expire(key, 3600)
            members = set(r.smembers(key))
        except Exception as e:
            logger.warning('Redis SADD failed, falling back to single-user: %s', e)
            members = {str(self.user.id)}

        with transaction.atomic():
            game = Game.objects.select_for_update().get(id=self.game_id)
            player_ids = {str(game.white_player_id), str(game.black_player_id)}
            player_ids.discard('None')

            both_online = (len(player_ids) >= 2) and (len(members & player_ids) >= 2)

            if both_online and game.status == 'waiting':
                now = timezone.now()
                game.status = 'active'
                game.started_at = now
                game.last_move_at = now
                game.save(update_fields=['status', 'started_at', 'last_move_at'])
                self.game = game
                return True

            # Если статус уже active, ничего не меняем
            self.game = game
            return False

    @database_sync_to_async
    def unregister_connection(self):
        try:
            r = _redis_client()
            key = f'game_{self.game_id}_connected'
            r.srem(key, str(self.user.id))
        except Exception as e:
            logger.warning('Redis SREM failed: %s', e)

    @database_sync_to_async
    def flag_cheating(self):
        from apps.games.models import Game
        Game.objects.filter(id=self.game_id).update(
            status='cheating',
            result_reason='illegal_move',
        )

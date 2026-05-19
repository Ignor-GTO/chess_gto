"""
Celery задача: отслеживание таймаута шахматных часов.

Проверяет активные партии каждые 10 секунд.
Если у кого-то кончилось время — завершает партию поражением.
"""
import logging
from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task
def check_game_timeouts():
    """
    Периодическая задача (каждые 10с).
    Проверяет все активные партии на превышение времени.

    Настройка в Django admin → Periodic Tasks:
      Task: apps.games.timeout_task.check_game_timeouts
      Crontab: every 10 seconds (*/10 * * * * *)
    """
    from apps.games.models import Game
    from apps.games.tasks import calculate_glicko2_ratings

    now = timezone.now()
    active_games = Game.objects.filter(
        status='active',
        last_move_at__isnull=False,
    ).select_related('white_player', 'black_player')

    finished_count = 0
    for game in active_games:
        # Определяем чья очередь ходить по FEN
        fen_turn = game.current_fen.split(' ')[1] if game.current_fen else 'w'

        if fen_turn == 'w':
            # Ходят белые — проверяем их часы
            clock = game.white_time_remaining
            if clock is None:
                continue
            # Время прошло с последнего хода
            elapsed = (now - game.last_move_at).total_seconds()
            remaining = clock - elapsed

            if remaining <= 0:
                logger.info(f'Таймаут белых в партии {game.id}')
                _end_by_timeout(game, winner='black')
                calculate_glicko2_ratings.delay(str(game.id))
                finished_count += 1
        else:
            # Ходят чёрные
            clock = game.black_time_remaining
            if clock is None:
                continue
            elapsed = (now - game.last_move_at).total_seconds()
            remaining = clock - elapsed

            if remaining <= 0:
                logger.info(f'Таймаут чёрных в партии {game.id}')
                _end_by_timeout(game, winner='white')
                calculate_glicko2_ratings.delay(str(game.id))
                finished_count += 1

    if finished_count:
        logger.info(f'Завершено по таймауту: {finished_count} партий')


def _end_by_timeout(game, winner: str):
    """Завершает партию поражением по времени."""
    from apps.games.models import Game
    from channels.layers import get_channel_layer
    from asgiref.sync import async_to_sync

    result = f'{winner}_win'
    game.status = 'finished'
    game.result = result
    game.result_reason = 'timeout'
    game.finished_at = timezone.now()
    game.save(update_fields=['status', 'result', 'result_reason', 'finished_at'])

    # Уведомляем игроков через WebSocket
    channel_layer = get_channel_layer()
    group_name = f'game_{game.id}'
    try:
        async_to_sync(channel_layer.group_send)(group_name, {
            'type': 'game_ended',
            'result': result,
            'reason': 'timeout',
        })
    except Exception as e:
        logger.warning(f'Не удалось отправить timeout WS: {e}')

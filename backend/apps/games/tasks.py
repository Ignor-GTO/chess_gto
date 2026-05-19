"""
Celery задача: расчёт рейтинга Glicko-2 после партии.

Алгоритм Glicko-2:
  - Каждый игрок имеет: rating (μ), deviation (φ), volatility (σ)
  - После партии оба обновляются на основе результата и силы соперника
  - Источник: http://www.glicko.net/glicko/glicko2.pdf
"""
import math
import logging
from celery import shared_task

logger = logging.getLogger(__name__)

# Константы Glicko-2
GLICKO2_SCALE = 173.7178   # q = ln(10) / 400 * этот коэффициент
TAU = 0.5                  # ограничение волатильности (рекомендуется 0.3–1.2)
EPSILON = 0.000001         # точность итерации


def _to_glicko2_scale(rating, deviation):
    """Конвертируем из Glicko-1 шкалы в Glicko-2."""
    mu = (rating - 1500) / GLICKO2_SCALE
    phi = deviation / GLICKO2_SCALE
    return mu, phi


def _from_glicko2_scale(mu, phi):
    """Конвертируем обратно в Glicko-1 шкалу."""
    rating = GLICKO2_SCALE * mu + 1500
    deviation = GLICKO2_SCALE * phi
    return rating, deviation


def _g(phi):
    """Функция g(φ)."""
    return 1 / math.sqrt(1 + 3 * phi ** 2 / math.pi ** 2)


def _E(mu, mu_j, phi_j):
    """Ожидаемый результат E(s|μ,μⱼ,φⱼ)."""
    return 1 / (1 + math.exp(-_g(phi_j) * (mu - mu_j)))


def _compute_new_rating(mu, phi, sigma, outcomes):
    """
    Основной расчёт Glicko-2 для одного игрока.

    outcomes: список [(mu_j, phi_j, score_j)]
      score_j = 1.0 (победа), 0.5 (ничья), 0.0 (поражение)
    """
    if not outcomes:
        # Нет партий — только увеличиваем отклонение
        phi_star = math.sqrt(phi ** 2 + sigma ** 2)
        return mu, phi_star, sigma

    # Шаг 1: вычисляем v (variance)
    v_sum = sum(
        _g(phi_j) ** 2 * _E(mu, mu_j, phi_j) * (1 - _E(mu, mu_j, phi_j))
        for mu_j, phi_j, _ in outcomes
    )
    v = 1 / v_sum

    # Шаг 2: вычисляем delta (improvement)
    delta_sum = sum(
        _g(phi_j) * (score_j - _E(mu, mu_j, phi_j))
        for mu_j, phi_j, score_j in outcomes
    )
    delta = v * delta_sum

    # Шаг 3: обновляем волатильность (итерация)
    a = math.log(sigma ** 2)
    f = lambda x: (
        math.exp(x) * (delta ** 2 - phi ** 2 - v - math.exp(x)) /
        (2 * (phi ** 2 + v + math.exp(x)) ** 2) - (x - a) / TAU ** 2
    )

    A = a
    if delta ** 2 > phi ** 2 + v:
        B = math.log(delta ** 2 - phi ** 2 - v)
    else:
        k = 1
        while f(a - k * TAU) < 0:
            k += 1
        B = a - k * TAU

    fa, fb = f(A), f(B)
    while abs(B - A) > EPSILON:
        C = A + (A - B) * fa / (fb - fa)
        fc = f(C)
        if fc * fb < 0:
            A, fa = B, fb
        else:
            fa /= 2
        B, fb = C, fc

    sigma_new = math.exp(A / 2)

    # Шаг 4: обновляем отклонение
    phi_star = math.sqrt(phi ** 2 + sigma_new ** 2)
    phi_new = 1 / math.sqrt(1 / phi_star ** 2 + 1 / v)

    # Шаг 5: обновляем рейтинг
    mu_new = mu + phi_new ** 2 * delta_sum

    return mu_new, phi_new, sigma_new


@shared_task(bind=True, max_retries=3)
def calculate_glicko2_ratings(self, game_id: str):
    """
    Celery задача: рассчитать и сохранить новые Glicko-2 рейтинги.
    Запускается после окончания партии.
    """
    from apps.games.models import Game
    from apps.users.models import User

    try:
        game = Game.objects.select_related('white_player', 'black_player').get(id=game_id)

        if game.status != 'finished' or not game.result:
            logger.warning(f'Game {game_id} not finished, skip rating calc')
            return

        white = game.white_player
        black = game.black_player

        if not white or not black:
            return

        # Определяем результаты
        result = game.result
        if result == 'white_win':
            white_score, black_score = 1.0, 0.0
        elif result == 'black_win':
            white_score, black_score = 0.0, 1.0
        else:  # draw
            white_score, black_score = 0.5, 0.5

        # Конвертируем в шкалу Glicko-2
        w_mu, w_phi = _to_glicko2_scale(white.rating, white.rating_deviation)
        b_mu, b_phi = _to_glicko2_scale(black.rating, black.rating_deviation)

        # Рассчитываем новые рейтинги
        w_mu_new, w_phi_new, w_sigma_new = _compute_new_rating(
            w_mu, w_phi, white.rating_volatility,
            [(b_mu, b_phi, white_score)]
        )
        b_mu_new, b_phi_new, b_sigma_new = _compute_new_rating(
            b_mu, b_phi, black.rating_volatility,
            [(w_mu, w_phi, black_score)]
        )

        # Конвертируем обратно
        w_rating_new, w_deviation_new = _from_glicko2_scale(w_mu_new, w_phi_new)
        b_rating_new, b_deviation_new = _from_glicko2_scale(b_mu_new, b_phi_new)

        # Ограничиваем минимальный рейтинг (Chess.com не даёт упасть ниже 100)
        w_rating_new = max(100, round(w_rating_new, 1))
        b_rating_new = max(100, round(b_rating_new, 1))

        # Сохраняем изменения рейтинга в партии
        w_change = round(w_rating_new - white.rating, 1)
        b_change = round(b_rating_new - black.rating, 1)

        game.white_rating_before = white.rating
        game.black_rating_before = black.rating
        game.white_rating_change = w_change
        game.black_rating_change = b_change
        game.save(update_fields=[
            'white_rating_before', 'black_rating_before',
            'white_rating_change', 'black_rating_change'
        ])

        # Обновляем пользователей
        # Белые
        white.rating = w_rating_new
        white.rating_deviation = round(w_deviation_new, 1)
        white.rating_volatility = round(w_sigma_new, 6)
        white.games_played += 1
        if result == 'white_win':
            white.games_won += 1
        elif result == 'black_win':
            white.games_lost += 1
        else:
            white.games_drawn += 1
        white.save(update_fields=[
            'rating', 'rating_deviation', 'rating_volatility',
            'games_played', 'games_won', 'games_lost', 'games_drawn'
        ])

        # Чёрные
        black.rating = b_rating_new
        black.rating_deviation = round(b_deviation_new, 1)
        black.rating_volatility = round(b_sigma_new, 6)
        black.games_played += 1
        if result == 'black_win':
            black.games_won += 1
        elif result == 'white_win':
            black.games_lost += 1
        else:
            black.games_drawn += 1
        black.save(update_fields=[
            'rating', 'rating_deviation', 'rating_volatility',
            'games_played', 'games_won', 'games_lost', 'games_drawn'
        ])

        logger.info(
            f'Glicko-2 updated: {white.username} {white.rating - w_change:.0f}'
            f'→{w_rating_new:.0f} ({w_change:+.1f}), '
            f'{black.username} {black.rating - b_change:.0f}'
            f'→{b_rating_new:.0f} ({b_change:+.1f})'
        )

    except Exception as exc:
        logger.error(f'Glicko-2 calc failed for game {game_id}: {exc}')
        raise self.retry(exc=exc, countdown=30)

"""
Модели партий: Game и Move
"""
import uuid
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.conf import settings


class Game(models.Model):
    """
    Шахматная партия. Хранит всю информацию о матче.
    """

    class TimeControl(models.TextChoices):
        BULLET_1 = 'bullet_1', _('Буллит 1+0')
        BULLET_1_1 = 'bullet_1_1', _('Буллит 1+1')
        BULLET_2_1 = 'bullet_2_1', _('Буллит 2+1')
        BLITZ_3 = 'blitz_3', _('Блиц 3+0')
        BLITZ_3_2 = 'blitz_3_2', _('Блиц 3+2')
        BLITZ_5 = 'blitz_5', _('Блиц 5+0')
        BLITZ_5_3 = 'blitz_5_3', _('Блиц 5+3')
        RAPID_10 = 'rapid_10', _('Рапид 10+0')
        RAPID_10_5 = 'rapid_10_5', _('Рапид 10+5')
        RAPID_15_10 = 'rapid_15_10', _('Рапид 15+10')
        CLASSICAL_30 = 'classical_30', _('Классика 30+0')

    class Status(models.TextChoices):
        WAITING = 'waiting', _('Ожидание')
        ACTIVE = 'active', _('Идёт')
        FINISHED = 'finished', _('Завершена')
        ABORTED = 'aborted', _('Прервана')
        CHEATING = 'cheating', _('Читерство')

    class Result(models.TextChoices):
        WHITE_WIN = 'white_win', _('Победа белых')
        BLACK_WIN = 'black_win', _('Победа чёрных')
        DRAW = 'draw', _('Ничья')
        ABORTED = 'aborted', _('Прервана')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Игроки
    white_player = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name='games_as_white',
        verbose_name=_('Белые')
    )
    black_player = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name='games_as_black',
        verbose_name=_('Чёрные')
    )

    # Контроль времени
    time_control = models.CharField(
        max_length=20, choices=TimeControl.choices,
        default=TimeControl.BLITZ_5,
        verbose_name=_('Контроль времени')
    )
    # Начальное время в секундах
    initial_time = models.PositiveIntegerField(default=300)
    # Добавка за ход в секундах
    increment = models.PositiveSmallIntegerField(default=0)

    # Оставшееся время (обновляется после каждого хода)
    white_time_remaining = models.FloatField(default=300.0)
    black_time_remaining = models.FloatField(default=300.0)

    # Статус и результат
    status = models.CharField(
        max_length=10, choices=Status.choices,
        default=Status.WAITING,
        verbose_name=_('Статус')
    )
    result = models.CharField(
        max_length=10, choices=Result.choices,
        null=True, blank=True,
        verbose_name=_('Результат')
    )
    result_reason = models.CharField(
        max_length=50, blank=True,
        verbose_name=_('Причина завершения')
        # checkmate, stalemate, timeout, resign, draw_agreement, repetition, etc.
    )

    # PGN (Portable Game Notation) — строка всей партии
    pgn = models.TextField(blank=True, verbose_name=_('PGN'))

    # FEN текущей позиции
    current_fen = models.TextField(
        default='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    )

    # Рейтинговые изменения
    white_rating_before = models.FloatField(null=True, blank=True)
    black_rating_before = models.FloatField(null=True, blank=True)
    white_rating_change = models.FloatField(null=True, blank=True)
    black_rating_change = models.FloatField(null=True, blank=True)

    # Метаданные
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    last_move_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = _('Партия')
        verbose_name_plural = _('Партии')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['white_player', '-created_at']),
            models.Index(fields=['black_player', '-created_at']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f'Game {self.id} [{self.status}]'


class Move(models.Model):
    """
    Отдельный ход в партии. Хранится для аналитики и воспроизведения.
    """

    class MoveClassification(models.TextChoices):
        """Классификация ходов (как у Chess.com)"""
        BRILLIANT = 'brilliant', _('Блестящий !!') # Жертва или неочевидный ход
        GREAT = 'great', _('Отличный !')
        BEST = 'best', _('Лучший')
        EXCELLENT = 'excellent', _('Хороший')
        GOOD = 'good', _('Нормальный')
        BOOK = 'book', _('Теория')
        INACCURACY = 'inaccuracy', _('Неточность ?!')
        MISTAKE = 'mistake', _('Ошибка ?')
        BLUNDER = 'blunder', _('Зевок ??')
        FORCED = 'forced', _('Вынужденный')
        MISS = 'miss', _('Упущено')

    game = models.ForeignKey(
        Game, on_delete=models.CASCADE,
        related_name='moves',
        verbose_name=_('Партия')
    )
    player = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True,
        verbose_name=_('Игрок')
    )

    # Номер хода (полуход: 1, 2, 3...)
    move_number = models.PositiveSmallIntegerField()
    # Ход в UCI нотации (e2e4, g1f3 и т.д.)
    uci = models.CharField(max_length=10)
    # Ход в SAN нотации (e4, Nf3 и т.д.)
    san = models.CharField(max_length=10)
    # FEN позиции ПОСЛЕ хода
    fen_after = models.TextField()

    # Время, затраченное на ход (мс)
    time_spent_ms = models.PositiveIntegerField(default=0)
    # Оставшееся время после хода (мс)
    clock_ms = models.PositiveIntegerField(default=0)

    # Оценка Stockfish (centipawn) после хода
    eval_cp = models.IntegerField(null=True, blank=True)
    # Лучший ход по движку
    best_move_uci = models.CharField(max_length=10, blank=True)
    # Классификация хода
    classification = models.CharField(
        max_length=15, choices=MoveClassification.choices,
        blank=True
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _('Ход')
        verbose_name_plural = _('Ходы')
        ordering = ['game', 'move_number']
        unique_together = [['game', 'move_number']]

    def __str__(self):
        return f'{self.game_id} — ход {self.move_number}: {self.san}'

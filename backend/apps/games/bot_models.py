"""
Модель партии против бота (хранится в БД для истории и анализа).
"""
import uuid
from django.db import models
from django.conf import settings
from django.utils.translation import gettext_lazy as _


class BotGame(models.Model):
    """
    Партия против Stockfish бота.
    Бот играет на клиенте (WASM) — сервер только хранит результат.
    """

    class Result(models.TextChoices):
        WHITE_WIN = 'white_win', _('Победа белых')
        BLACK_WIN = 'black_win', _('Победа чёрных')
        DRAW      = 'draw',      _('Ничья')

    class Status(models.TextChoices):
        ACTIVE   = 'active',    _('Идёт')
        FINISHED = 'finished',  _('Завершена')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    player = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='bot_games',
        verbose_name=_('Игрок')
    )
    player_color = models.CharField(
        max_length=5, choices=[('white','Белые'), ('black','Чёрные')],
        default='white'
    )
    # Уровень сложности (UCI Skill Level 0–20)
    skill_level = models.PositiveSmallIntegerField(default=10)

    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.ACTIVE
    )
    result = models.CharField(
        max_length=10, choices=Result.choices, null=True, blank=True
    )
    result_reason = models.CharField(max_length=50, blank=True)

    # PGN и позиция
    pgn         = models.TextField(blank=True)
    current_fen = models.TextField(
        default='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    )

    created_at  = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = _('Партия vs бот')
        verbose_name_plural = _('Партии vs бот')
        ordering = ['-created_at']
        indexes = [models.Index(fields=['player', '-created_at'])]

    def __str__(self):
        return f'BotGame {self.id} | {self.player} skill={self.skill_level}'

    @property
    def bot_rating(self):
        """Приблизительный рейтинг бота."""
        return {0: 800, 5: 1200, 10: 1600, 15: 2000, 20: 2500}.get(
            self.skill_level, 1500
        )

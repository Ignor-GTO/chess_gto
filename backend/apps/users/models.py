"""
Модели: User с рейтингом Glicko-2
"""
import uuid
import math
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.translation import gettext_lazy as _


class User(AbstractUser):
    """
    Кастомная модель пользователя с Glicko-2 рейтингом.
    Glicko-2 использует три параметра: rating (μ), rd (φ), volatility (σ).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    avatar = models.ImageField(
        upload_to='avatars/', null=True, blank=True,
        verbose_name=_('Аватар')
    )

    # --- Glicko-2 параметры ---
    # Рейтинг (μ), стартовое значение 1500 (как у Chess.com)
    rating = models.FloatField(default=1500.0, verbose_name=_('Рейтинг'))
    # Отклонение рейтинга (φ), чем выше — тем менее точен рейтинг
    rating_deviation = models.FloatField(default=350.0, verbose_name=_('Отклонение'))
    # Волатильность (σ) — непредсказуемость игрока
    rating_volatility = models.FloatField(default=0.06, verbose_name=_('Волатильность'))

    # --- Статистика ---
    games_played = models.PositiveIntegerField(default=0)
    games_won = models.PositiveIntegerField(default=0)
    games_lost = models.PositiveIntegerField(default=0)
    games_drawn = models.PositiveIntegerField(default=0)

    # --- Профиль ---
    country = models.CharField(max_length=2, blank=True, default='UZ')
    bio = models.TextField(blank=True)
    is_online = models.BooleanField(default=False)
    last_seen = models.DateTimeField(null=True, blank=True)

    # --- Предпочтения ---
    preferred_language = models.CharField(
        max_length=5, default='ru',
        choices=[('ru', 'Русский'), ('uz', "O'zbek"), ('en', 'English')]
    )

    class Meta:
        verbose_name = _('Пользователь')
        verbose_name_plural = _('Пользователи')

    def __str__(self):
        return f'{self.username} [{self.rating:.0f}]'

    @property
    def win_rate(self):
        """Процент побед."""
        if self.games_played == 0:
            return 0
        return round(self.games_won / self.games_played * 100, 1)

"""
Django Admin регистрация всех моделей платформы.
"""
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.translation import gettext_lazy as _
from apps.users.models import User
from apps.games.models import Game, Move
from apps.games.bot_models import BotGame


# ── Пользователи ────────────────────────────────────────────────────────────

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display  = ('username', 'email', 'rating', 'games_played', 'is_online', 'is_staff')
    list_filter   = ('is_staff', 'is_active', 'country', 'preferred_language')
    search_fields = ('username', 'email')
    ordering      = ('-rating',)

    fieldsets = BaseUserAdmin.fieldsets + (
        (_('Glicko-2 рейтинг'), {
            'fields': ('rating', 'rating_deviation', 'rating_volatility'),
        }),
        (_('Статистика'), {
            'fields': ('games_played', 'games_won', 'games_lost', 'games_drawn'),
        }),
        (_('Профиль'), {
            'fields': ('avatar', 'country', 'bio', 'preferred_language', 'is_online', 'last_seen'),
        }),
    )
    readonly_fields = ('games_played', 'games_won', 'games_lost', 'games_drawn', 'last_seen')


# ── Ходы (inline в партии) ──────────────────────────────────────────────────

class MoveInline(admin.TabularInline):
    model  = Move
    extra  = 0
    fields = ('move_number', 'san', 'uci', 'time_spent_ms', 'eval_cp', 'classification')
    readonly_fields = fields


# ── Партии ──────────────────────────────────────────────────────────────────

@admin.register(Game)
class GameAdmin(admin.ModelAdmin):
    list_display  = (
        'id', 'white_player', 'black_player', 'time_control',
        'status', 'result', 'white_rating_change', 'black_rating_change', 'created_at'
    )
    list_filter   = ('status', 'result', 'time_control')
    search_fields = ('white_player__username', 'black_player__username', 'id')
    ordering      = ('-created_at',)
    readonly_fields = (
        'id', 'white_rating_before', 'black_rating_before',
        'white_rating_change', 'black_rating_change',
        'created_at', 'started_at', 'finished_at', 'last_move_at',
    )
    inlines = [MoveInline]

    fieldsets = (
        ('Игроки', {'fields': ('white_player', 'black_player')}),
        ('Контроль времени', {
            'fields': ('time_control', 'initial_time', 'increment',
                       'white_time_remaining', 'black_time_remaining')
        }),
        ('Статус', {
            'fields': ('status', 'result', 'result_reason', 'current_fen')
        }),
        ('Рейтинг', {
            'fields': ('white_rating_before', 'black_rating_before',
                       'white_rating_change', 'black_rating_change')
        }),
        ('Даты', {
            'fields': ('created_at', 'started_at', 'finished_at', 'last_move_at')
        }),
    )

    @admin.action(description='Пересчитать Glicko-2 рейтинг')
    def recalculate_ratings(self, request, queryset):
        from apps.games.tasks import calculate_glicko2_ratings
        for game in queryset.filter(status='finished'):
            calculate_glicko2_ratings.delay(str(game.id))
        self.message_user(request, f'Запущен пересчёт для {queryset.count()} партий')

    actions = ['recalculate_ratings']


# ── Партии vs Бот ────────────────────────────────────────────────────────────

@admin.register(BotGame)
class BotGameAdmin(admin.ModelAdmin):
    list_display  = ('id', 'player', 'skill_level', 'player_color', 'status', 'result', 'created_at')
    list_filter   = ('status', 'result', 'skill_level', 'player_color')
    search_fields = ('player__username',)
    ordering      = ('-created_at',)
    readonly_fields = ('id', 'created_at', 'finished_at')

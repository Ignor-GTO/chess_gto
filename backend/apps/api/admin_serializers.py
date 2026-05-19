"""Сериализаторы Vue-админки."""
from rest_framework import serializers
from django.contrib.auth import get_user_model
from apps.games.models import Game
from apps.games.bot_models import BotGame

User = get_user_model()


class AdminUserSerializer(serializers.ModelSerializer):
    win_rate = serializers.ReadOnlyField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'is_active', 'is_staff', 'is_superuser',
            'rating', 'rating_deviation', 'games_played', 'games_won',
            'games_lost', 'games_drawn', 'win_rate', 'is_online',
            'country', 'date_joined', 'last_seen',
        ]
        read_only_fields = [
            'id', 'username', 'rating', 'rating_deviation',
            'games_played', 'games_won', 'games_lost', 'games_drawn',
            'date_joined', 'last_seen',
        ]


class AdminUserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['is_active', 'is_staff', 'email']


class AdminGameSerializer(serializers.ModelSerializer):
    white_username = serializers.CharField(source='white_player.username', read_only=True)
    black_username = serializers.CharField(source='black_player.username', read_only=True)

    class Meta:
        model = Game
        fields = [
            'id', 'white_username', 'black_username',
            'time_control', 'status', 'result', 'result_reason',
            'white_rating_change', 'black_rating_change',
            'created_at', 'finished_at',
        ]


class AdminBotGameSerializer(serializers.ModelSerializer):
    player_username = serializers.CharField(source='player.username', read_only=True)

    class Meta:
        model = BotGame
        fields = [
            'id', 'player_username', 'skill_level', 'player_color',
            'status', 'result', 'created_at', 'finished_at',
        ]

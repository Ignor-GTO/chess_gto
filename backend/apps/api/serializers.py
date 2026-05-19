"""
DRF Serializers для API.
"""
from rest_framework import serializers
from django.contrib.auth import get_user_model
from apps.games.models import Game, Move

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    """Сериализатор регистрации."""
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'preferred_language']

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class UserSerializer(serializers.ModelSerializer):
    """Публичный профиль пользователя."""
    win_rate = serializers.ReadOnlyField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'avatar', 'country',
            'rating', 'rating_deviation',
            'games_played', 'games_won', 'games_lost', 'games_drawn',
            'win_rate', 'is_online',
        ]


class UserProfileSerializer(serializers.ModelSerializer):
    """Расширенный профиль (для /me/)."""
    win_rate = serializers.ReadOnlyField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'avatar', 'country', 'bio',
            'rating', 'rating_deviation', 'rating_volatility',
            'games_played', 'games_won', 'games_lost', 'games_drawn',
            'win_rate', 'preferred_language', 'is_online', 'last_seen',
            'is_staff',
        ]
        read_only_fields = [
            'rating', 'rating_deviation', 'rating_volatility',
            'games_played', 'games_won', 'games_lost', 'games_drawn',
            'is_staff',
        ]


class MoveSerializer(serializers.ModelSerializer):
    class Meta:
        model = Move
        fields = [
            'move_number', 'uci', 'san', 'fen_after',
            'time_spent_ms', 'clock_ms',
            'eval_cp', 'classification',
        ]


class GameSerializer(serializers.ModelSerializer):
    """Краткая информация о партии (для списка)."""
    white_player = UserSerializer(read_only=True)
    black_player = UserSerializer(read_only=True)

    class Meta:
        model = Game
        fields = [
            'id', 'white_player', 'black_player',
            'time_control', 'status', 'result', 'result_reason',
            'white_rating_change', 'black_rating_change',
            'created_at', 'finished_at',
        ]


class GameDetailSerializer(serializers.ModelSerializer):
    """Детальная информация (с ходами и PGN)."""
    white_player = UserSerializer(read_only=True)
    black_player = UserSerializer(read_only=True)
    moves = MoveSerializer(many=True, read_only=True)

    class Meta:
        model = Game
        fields = [
            'id', 'white_player', 'black_player',
            'time_control', 'initial_time', 'increment',
            'white_time_remaining', 'black_time_remaining',
            'status', 'result', 'result_reason',
            'pgn', 'current_fen',
            'white_rating_before', 'black_rating_before',
            'white_rating_change', 'black_rating_change',
            'created_at', 'started_at', 'finished_at',
            'moves',
        ]

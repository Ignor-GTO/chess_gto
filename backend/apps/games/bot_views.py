"""
API для партий против бота: создание, список, обновление, статистика.
"""
from django.db.models import Q
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from .bot_models import BotGame


def compute_bot_stats(user):
    """Статистика vs бот — отдельно от Glicko-2 рейтинга."""
    finished = BotGame.objects.filter(player=user, status='finished')
    wins = finished.filter(
        Q(player_color='white', result='white_win') |
        Q(player_color='black', result='black_win')
    ).count()
    losses = finished.filter(
        Q(player_color='white', result='black_win') |
        Q(player_color='black', result='white_win')
    ).count()
    draws = finished.filter(result='draw').count()
    played = wins + losses + draws
    return {
        'games_played': played,
        'games_won': wins,
        'games_lost': losses,
        'games_drawn': draws,
        'win_rate': round(wins / played * 100, 1) if played else 0,
    }


class BotStatsView(APIView):
    """GET /api/games/bot/stats/ — статистика партий vs бот (не влияет на рейтинг)."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(compute_bot_stats(request.user))


class BotGameSerializer:
    """Inline serializer to avoid circular imports."""

    @staticmethod
    def serialize(game):
        return {
            'id': str(game.id),
            'skill_level': game.skill_level,
            'player_color': game.player_color,
            'status': game.status,
            'result': game.result,
            'result_reason': game.result_reason,
            'pgn': game.pgn,
            'current_fen': game.current_fen,
            'created_at': game.created_at,
            'finished_at': game.finished_at,
        }


class BotGameListView(generics.ListAPIView):
    """GET /api/games/bot/ — история партий vs бот."""
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request, *args, **kwargs):
        qs = BotGame.objects.filter(player=request.user).order_by('-created_at')[:20]
        return Response([BotGameSerializer.serialize(g) for g in qs])


class BotGameDetailView(generics.RetrieveAPIView):
    """GET /api/games/bot/<id>/ — детали партии vs бот."""
    permission_classes = [permissions.IsAuthenticated]

    def retrieve(self, request, *args, **kwargs):
        game = BotGame.objects.get(id=kwargs['pk'], player=request.user)
        return Response(BotGameSerializer.serialize(game))


class BotGameCreateView(generics.CreateAPIView):
    """POST /api/games/bot/create/ — создать запись партии vs бот."""
    permission_classes = [permissions.IsAuthenticated]

    def create(self, request):
        game = BotGame.objects.create(
            player=request.user,
            skill_level=request.data.get('skill_level', 10),
            player_color=request.data.get('player_color', 'white'),
        )
        return Response({'id': str(game.id)}, status=201)


class BotGameUpdateView(generics.UpdateAPIView):
    """PATCH /api/games/bot/<id>/ — обновить PGN и результат."""
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ['patch']

    def get_queryset(self):
        return BotGame.objects.filter(player=self.request.user)

    def partial_update(self, request, *args, **kwargs):
        game = self.get_object()
        data = request.data

        if 'pgn' in data:
            game.pgn = data['pgn']
        if 'current_fen' in data:
            game.current_fen = data['current_fen']
        if 'status' in data:
            game.status = data['status']
        if 'result' in data:
            game.result = data['result']
        if 'result_reason' in data:
            game.result_reason = data['result_reason']
        if data.get('status') == 'finished':
            game.finished_at = timezone.now()

        game.save()
        return Response({'id': str(game.id)})

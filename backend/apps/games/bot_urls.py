"""URL маршруты для bot games и online count."""
from django.urls import path
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny

from apps.games.bot_views import (
    BotGameListView,
    BotGameDetailView,
    BotGameCreateView,
    BotGameUpdateView,
    BotStatsView,
)
from apps.games.presence import get_online_count


class OnlineCountView(APIView):
    """GET /api/users/online-count/ — количество онлайн пользователей."""
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({'count': get_online_count()})


bot_urlpatterns = [
    path('api/games/bot/stats/', BotStatsView.as_view(), name='bot_game_stats'),
    path('api/games/bot/', BotGameListView.as_view(), name='bot_game_list'),
    path('api/games/bot/create/', BotGameCreateView.as_view(), name='bot_game_create'),
    path('api/games/bot/<uuid:pk>/', BotGameUpdateView.as_view(), name='bot_game_update'),
    path('api/games/bot/<uuid:pk>/detail/', BotGameDetailView.as_view(), name='bot_game_detail'),
    path('api/users/online-count/', OnlineCountView.as_view(), name='online_count'),
]

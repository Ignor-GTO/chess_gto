"""
Django REST API: ViewSets для пользователей, партий и лобби.
"""
from rest_framework import viewsets, generics, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth import get_user_model
from django.db.models import Q
import uuid

from apps.games.models import Game
from .serializers import (
    UserSerializer, UserProfileSerializer,
    GameSerializer, GameDetailSerializer,
    RegisterSerializer,
)

User = get_user_model()


# ── Аутентификация ───────────────────────────────────────────────────────────

class RegisterView(generics.CreateAPIView):
    """POST /api/auth/register/ — регистрация нового пользователя."""
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


# ── Профиль пользователя ─────────────────────────────────────────────────────

class UserMeView(generics.RetrieveUpdateAPIView):
    """GET/PATCH /api/users/me/ — профиль текущего пользователя."""
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class UserDetailView(generics.RetrieveAPIView):
    """GET /api/users/<username>/ — публичный профиль."""
    serializer_class = UserSerializer
    permission_classes = [permissions.AllowAny]
    queryset = User.objects.all()
    lookup_field = 'username'


# ── Партии ───────────────────────────────────────────────────────────────────

class GameViewSet(viewsets.ModelViewSet):
    """
    CRUD для партий.
    list   → история игр текущего пользователя
    create → создать новую партию (лобби)
    """
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return GameDetailSerializer
        return GameSerializer

    def get_queryset(self):
        user = self.request.user
        return Game.objects.filter(
            Q(white_player=user) | Q(black_player=user)
        ).select_related('white_player', 'black_player').order_by('-created_at')

    def create(self, request):
        """
        POST /api/games/ — создаём партию.
        Если есть ожидающая партия с тем же контролем → вступаем.
        Иначе создаём новую (ждём соперника).
        """
        time_control = request.data.get('time_control', 'blitz_5')

        # Ищем партию в лобби
        waiting_game = Game.objects.filter(
            status='waiting',
            time_control=time_control,
        ).exclude(white_player=request.user).first()

        if waiting_game:
            waiting_game.black_player = request.user
            waiting_game.save(update_fields=['black_player'])
            return Response({
                'game_id': str(waiting_game.id),
                'color': 'black',
                'opponent': waiting_game.white_player.username,
            })

        # Получаем параметры времени
        time_map = {
            'bullet_1': (60, 0), 'bullet_1_1': (60, 1), 'bullet_2_1': (120, 1),
            'blitz_3': (180, 0), 'blitz_3_2': (180, 2), 'blitz_5': (300, 0),
            'blitz_5_3': (300, 3), 'rapid_10': (600, 0), 'rapid_10_5': (600, 5),
            'rapid_15_10': (900, 10), 'classical_30': (1800, 0),
        }
        initial, increment = time_map.get(time_control, (300, 0))

        game = Game.objects.create(
            white_player=request.user,
            time_control=time_control,
            initial_time=initial,
            increment=increment,
            white_time_remaining=initial,
            black_time_remaining=initial,
            status='waiting',
        )
        return Response({
            'game_id': str(game.id),
            'color': 'white',
            'opponent': None,
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def pgn(self, request, pk=None):
        """GET /api/games/<id>/pgn/ — скачать PGN файл."""
        game = self.get_object()
        return Response({'pgn': game.pgn})

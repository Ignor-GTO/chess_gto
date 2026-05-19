"""REST API для Vue-админки."""
from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.games.models import Game
from apps.games.bot_models import BotGame
from apps.games.tasks import calculate_glicko2_ratings
from .permissions import IsStaffUser
from .admin_serializers import (
    AdminUserSerializer,
    AdminUserUpdateSerializer,
    AdminGameSerializer,
    AdminBotGameSerializer,
)

User = get_user_model()


class AdminStatsView(APIView):
    """GET /api/admin/stats/ — сводка для дашборда."""

    def get_permissions(self):
        return [IsStaffUser()]

    def get(self, request):
        today = timezone.now().date()
        week_ago = timezone.now() - timezone.timedelta(days=7)
        return Response({
            'users_total': User.objects.count(),
            'users_online': User.objects.filter(is_online=True).count(),
            'users_new_today': User.objects.filter(date_joined__date=today).count(),
            'users_new_week': User.objects.filter(date_joined__gte=week_ago).count(),
            'games_total': Game.objects.count(),
            'games_today': Game.objects.filter(created_at__date=today).count(),
            'games_active': Game.objects.filter(status='active').count(),
            'games_waiting': Game.objects.filter(status='waiting').count(),
            'bot_games_total': BotGame.objects.count(),
            'bot_games_today': BotGame.objects.filter(created_at__date=today).count(),
        })


class AdminUserListView(generics.ListAPIView):
    """GET /api/admin/users/ — список пользователей."""

    serializer_class = AdminUserSerializer
    permission_classes = [IsStaffUser]
    pagination_class = None

    def get_queryset(self):
        qs = User.objects.all().order_by('-date_joined')
        search = self.request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(username__icontains=search) | Q(email__icontains=search)
            )
        active = self.request.query_params.get('is_active')
        if active in ('true', 'false'):
            qs = qs.filter(is_active=(active == 'true'))
        staff = self.request.query_params.get('is_staff')
        if staff in ('true', 'false'):
            qs = qs.filter(is_staff=(staff == 'true'))
        return qs[:100]


class AdminUserDetailView(generics.RetrieveUpdateAPIView):
    """GET/PATCH /api/admin/users/<uuid>/ — пользователь."""

    permission_classes = [IsStaffUser]
    lookup_field = 'id'

    def get_queryset(self):
        return User.objects.all()

    def get_serializer_class(self):
        if self.request.method in ('PATCH', 'PUT'):
            return AdminUserUpdateSerializer
        return AdminUserSerializer

    def update(self, request, *args, **kwargs):
        user = self.get_object()
        if user.is_superuser and user.id != request.user.id:
            if 'is_staff' in request.data and not request.data.get('is_staff'):
                return Response(
                    {'detail': 'Нельзя снять staff у superuser.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        serializer = self.get_serializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(AdminUserSerializer(user).data)


class AdminGameListView(generics.ListAPIView):
    """GET /api/admin/games/ — все PvP-партии."""

    serializer_class = AdminGameSerializer
    permission_classes = [IsStaffUser]
    pagination_class = None

    def get_queryset(self):
        qs = Game.objects.select_related('white_player', 'black_player').order_by('-created_at')
        game_status = self.request.query_params.get('status')
        if game_status:
            qs = qs.filter(status=game_status)
        result = self.request.query_params.get('result')
        if result:
            qs = qs.filter(result=result)
        search = self.request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(white_player__username__icontains=search)
                | Q(black_player__username__icontains=search)
                | Q(id__icontains=search)
            )
        return qs[:100]


class AdminBotGameListView(generics.ListAPIView):
    """GET /api/admin/bot-games/ — партии vs бот."""

    serializer_class = AdminBotGameSerializer
    permission_classes = [IsStaffUser]
    pagination_class = None

    def get_queryset(self):
        qs = BotGame.objects.select_related('player').order_by('-created_at')
        game_status = self.request.query_params.get('status')
        if game_status:
            qs = qs.filter(status=game_status)
        return qs[:100]


class AdminRecalculateRatingView(APIView):
    """POST /api/admin/games/<uuid>/recalculate-rating/ — пересчёт Glicko-2."""

    def get_permissions(self):
        return [IsStaffUser()]

    def post(self, request, pk):
        try:
            game = Game.objects.get(id=pk)
        except Game.DoesNotExist:
            return Response({'detail': 'Партия не найдена.'}, status=status.HTTP_404_NOT_FOUND)
        if game.status != 'finished':
            return Response(
                {'detail': 'Пересчёт только для завершённых партий.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        calculate_glicko2_ratings.delay(str(game.id))
        return Response({'detail': 'Пересчёт рейтинга запущен.'})

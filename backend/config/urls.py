"""
URL маршруты Django проекта.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenBlacklistView,
)
from apps.api.views import (
    RegisterView, UserMeView, UserDetailView, GameViewSet,
)
from apps.games.bot_urls import bot_urlpatterns

# DRF Router для ViewSets
router = DefaultRouter()
router.register(r'games', GameViewSet, basename='game')

urlpatterns = [
    path('admin/', admin.site.urls),

    # ── Аутентификация (JWT) ──────────────────────────────
    path('api/auth/token/',           TokenObtainPairView.as_view(),    name='token_obtain'),
    path('api/auth/token/refresh/',   TokenRefreshView.as_view(),       name='token_refresh'),
    path('api/auth/token/blacklist/', TokenBlacklistView.as_view(),     name='token_blacklist'),
    path('api/auth/register/',        RegisterView.as_view(),           name='register'),

    # ── Пользователи ─────────────────────────────────────
    path('api/users/me/',             UserMeView.as_view(),             name='user_me'),
    path('api/users/<str:username>/', UserDetailView.as_view(),         name='user_detail'),

    # ── Партии + Лобби ───────────────────────────────────
    path('api/', include(router.urls)),

    # ── i18n ─────────────────────────────────────────────
    path('i18n/', include('django.conf.urls.i18n')),

] + bot_urlpatterns

# Медиафайлы в dev режиме
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

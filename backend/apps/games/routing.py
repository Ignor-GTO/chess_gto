from django.urls import re_path
from apps.games.consumers import GameConsumer
from apps.games.presence_consumer import PresenceConsumer

websocket_urlpatterns = [
    re_path(r'ws/game/(?P<game_id>[0-9a-f-]+)/$', GameConsumer.as_asgi()),
    re_path(r'ws/presence/$', PresenceConsumer.as_asgi()),
]

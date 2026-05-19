"""WebSocket consumer for online presence (lobby counter)."""
import json
import logging

from channels.generic.websocket import AsyncWebsocketConsumer

from .presence import user_connected, user_disconnected, set_user_online

logger = logging.getLogger(__name__)


class PresenceConsumer(AsyncWebsocketConsumer):
    """ws/presence/ — heartbeat для счётчика онлайн игроков."""

    async def connect(self):
        self.user = self.scope.get('user')
        if not self.user or not self.user.is_authenticated:
            await self.close(code=4001)
            return

        await self.accept()
        count = user_connected(str(self.user.id))
        await set_user_online(self.user.id, True)
        await self.send(json.dumps({'type': 'online_count', 'count': count}))
        logger.debug('Presence connect: %s (count=%s)', self.user.username, count)

    async def disconnect(self, close_code):
        if hasattr(self, 'user') and self.user.is_authenticated:
            count = user_disconnected(str(self.user.id))
            await set_user_online(self.user.id, False)
            logger.debug('Presence disconnect: %s (count=%s)', self.user.username, count)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return
        if data.get('type') == 'ping':
            user_connected(str(self.user.id))
            await self.send(json.dumps({'type': 'pong'}))

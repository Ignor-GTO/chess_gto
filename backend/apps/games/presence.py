"""Online presence tracking via Redis cache."""
from django.core.cache import cache
from django.utils import timezone
from channels.db import database_sync_to_async

ONLINE_COUNT_KEY = 'online_users_count'
ONLINE_USERS_KEY = 'online_user_ids'
TTL_SECONDS = 120


def _refresh_online_count():
    user_ids = cache.get(ONLINE_USERS_KEY) or set()
    cache.set(ONLINE_COUNT_KEY, len(user_ids), timeout=TTL_SECONDS * 2)
    return len(user_ids)


def user_connected(user_id: str) -> int:
    user_ids = cache.get(ONLINE_USERS_KEY) or set()
    user_ids = set(user_ids)
    user_ids.add(str(user_id))
    cache.set(ONLINE_USERS_KEY, user_ids, timeout=TTL_SECONDS * 2)
    return _refresh_online_count()


def user_disconnected(user_id: str) -> int:
    user_ids = cache.get(ONLINE_USERS_KEY) or set()
    user_ids = set(user_ids)
    user_ids.discard(str(user_id))
    cache.set(ONLINE_USERS_KEY, user_ids, timeout=TTL_SECONDS * 2)
    return _refresh_online_count()


def get_online_count() -> int:
    return cache.get(ONLINE_COUNT_KEY) or 0


@database_sync_to_async
def set_user_online(user_id, online: bool):
    from apps.users.models import User
    User.objects.filter(id=user_id).update(
        is_online=online,
        last_seen=timezone.now(),
    )

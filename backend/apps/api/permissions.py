"""Права доступа для API."""
from rest_framework.permissions import BasePermission


class IsStaffUser(BasePermission):
    """Доступ только для staff (Vue-админка)."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_staff
        )

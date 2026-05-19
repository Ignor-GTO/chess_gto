"""Celery application for chess_gto."""
import os

from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('chess_gto')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

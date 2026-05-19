import uuid
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Game',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('time_control', models.CharField(choices=[('bullet_1', 'Буллит 1+0'), ('bullet_1_1', 'Буллит 1+1'), ('bullet_2_1', 'Буллит 2+1'), ('blitz_3', 'Блиц 3+0'), ('blitz_3_2', 'Блиц 3+2'), ('blitz_5', 'Блиц 5+0'), ('blitz_5_3', 'Блиц 5+3'), ('rapid_10', 'Рапид 10+0'), ('rapid_10_5', 'Рапид 10+5'), ('rapid_15_10', 'Рапид 15+10'), ('classical_30', 'Классика 30+0')], default='blitz_5', max_length=20, verbose_name='Контроль времени')),
                ('initial_time', models.PositiveIntegerField(default=300)),
                ('increment', models.PositiveSmallIntegerField(default=0)),
                ('white_time_remaining', models.FloatField(default=300.0)),
                ('black_time_remaining', models.FloatField(default=300.0)),
                ('status', models.CharField(choices=[('waiting', 'Ожидание'), ('active', 'Идёт'), ('finished', 'Завершена'), ('aborted', 'Прервана'), ('cheating', 'Читерство')], default='waiting', max_length=10, verbose_name='Статус')),
                ('result', models.CharField(blank=True, choices=[('white_win', 'Победа белых'), ('black_win', 'Победа чёрных'), ('draw', 'Ничья'), ('aborted', 'Прервана')], max_length=10, null=True, verbose_name='Результат')),
                ('result_reason', models.CharField(blank=True, max_length=50, verbose_name='Причина завершения')),
                ('pgn', models.TextField(blank=True, verbose_name='PGN')),
                ('current_fen', models.TextField(default='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')),
                ('white_rating_before', models.FloatField(blank=True, null=True)),
                ('black_rating_before', models.FloatField(blank=True, null=True)),
                ('white_rating_change', models.FloatField(blank=True, null=True)),
                ('black_rating_change', models.FloatField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('started_at', models.DateTimeField(blank=True, null=True)),
                ('finished_at', models.DateTimeField(blank=True, null=True)),
                ('last_move_at', models.DateTimeField(blank=True, null=True)),
                ('black_player', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='games_as_black', to=settings.AUTH_USER_MODEL, verbose_name='Чёрные')),
                ('white_player', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='games_as_white', to=settings.AUTH_USER_MODEL, verbose_name='Белые')),
            ],
            options={
                'verbose_name': 'Партия',
                'verbose_name_plural': 'Партии',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='BotGame',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('player_color', models.CharField(choices=[('white', 'Белые'), ('black', 'Чёрные')], default='white', max_length=5)),
                ('skill_level', models.PositiveSmallIntegerField(default=10)),
                ('status', models.CharField(choices=[('active', 'Идёт'), ('finished', 'Завершена')], default='active', max_length=10)),
                ('result', models.CharField(blank=True, choices=[('white_win', 'Победа белых'), ('black_win', 'Победа чёрных'), ('draw', 'Ничья')], max_length=10, null=True)),
                ('result_reason', models.CharField(blank=True, max_length=50)),
                ('pgn', models.TextField(blank=True)),
                ('current_fen', models.TextField(default='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('finished_at', models.DateTimeField(blank=True, null=True)),
                ('player', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='bot_games', to=settings.AUTH_USER_MODEL, verbose_name='Игрок')),
            ],
            options={
                'verbose_name': 'Партия vs бот',
                'verbose_name_plural': 'Партии vs бот',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='Move',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('move_number', models.PositiveSmallIntegerField()),
                ('uci', models.CharField(max_length=10)),
                ('san', models.CharField(max_length=10)),
                ('fen_after', models.TextField()),
                ('time_spent_ms', models.PositiveIntegerField(default=0)),
                ('clock_ms', models.PositiveIntegerField(default=0)),
                ('eval_cp', models.IntegerField(blank=True, null=True)),
                ('best_move_uci', models.CharField(blank=True, max_length=10)),
                ('classification', models.CharField(blank=True, choices=[('brilliant', 'Блестящий !!'), ('great', 'Отличный !'), ('best', 'Лучший'), ('excellent', 'Хороший'), ('good', 'Нормальный'), ('book', 'Теория'), ('inaccuracy', 'Неточность ?!'), ('mistake', 'Ошибка ?'), ('blunder', 'Зевок ??'), ('forced', 'Вынужденный'), ('miss', 'Упущено')], max_length=15)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('game', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='moves', to='games.game', verbose_name='Партия')),
                ('player', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL, verbose_name='Игрок')),
            ],
            options={
                'verbose_name': 'Ход',
                'verbose_name_plural': 'Ходы',
                'ordering': ['game', 'move_number'],
                'unique_together': {('game', 'move_number')},
            },
        ),
        migrations.AddIndex(
            model_name='game',
            index=models.Index(fields=['white_player', '-created_at'], name='games_game_white_p_idx'),
        ),
        migrations.AddIndex(
            model_name='game',
            index=models.Index(fields=['black_player', '-created_at'], name='games_game_black_p_idx'),
        ),
        migrations.AddIndex(
            model_name='game',
            index=models.Index(fields=['status'], name='games_game_status_idx'),
        ),
        migrations.AddIndex(
            model_name='botgame',
            index=models.Index(fields=['player', '-created_at'], name='games_botga_player__idx'),
        ),
    ]

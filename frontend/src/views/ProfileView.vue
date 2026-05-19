<template>
  <div class="profile-view">
    <div v-if="loading" class="loading">Загрузка...</div>

    <div v-else-if="user" class="profile-content">
      <!-- Шапка профиля -->
      <div class="profile-header">
        <div class="profile-avatar">
          <img v-if="user.avatar" :src="user.avatar" :alt="user.username" />
          <span v-else class="avatar-big">{{ user.username[0].toUpperCase() }}</span>
        </div>
        <div class="profile-meta">
          <h1 class="profile-username">{{ user.username }}</h1>
          <div class="profile-badges">
            <span class="badge">🌍 {{ user.country }}</span>
            <span class="badge online" v-if="user.is_online">🟢 Онлайн</span>
          </div>
        </div>
      </div>

      <!-- Онлайн рейтинг (Glicko-2) -->
      <div class="rating-card">
        <div class="rating-value">{{ Math.round(user.rating) }}</div>
        <div class="rating-label">{{ $t('profile.onlineRating') }}</div>
        <div class="rating-rd">± {{ Math.round(user.rating_deviation) }}</div>
      </div>

      <!-- Онлайн статистика -->
      <h3 class="section-title">{{ $t('profile.onlineStats') }}</h3>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">{{ user.games_played }}</div>
          <div class="stat-label">{{ $t('profile.games') }}</div>
        </div>
        <div class="stat-card wins">
          <div class="stat-value">{{ user.games_won }}</div>
          <div class="stat-label">{{ $t('profile.wins') }}</div>
        </div>
        <div class="stat-card losses">
          <div class="stat-value">{{ user.games_lost }}</div>
          <div class="stat-label">{{ $t('profile.losses') }}</div>
        </div>
        <div class="stat-card draws">
          <div class="stat-value">{{ user.games_drawn }}</div>
          <div class="stat-label">{{ $t('profile.draws') }}</div>
        </div>
      </div>

      <div class="win-rate-bar" v-if="user.games_played > 0">
        <div class="wr-label">{{ $t('profile.winRate') }}: {{ user.win_rate }}%</div>
        <div class="wr-track">
          <div class="wr-fill wins"  :style="{ width: winPercent + '%' }"></div>
          <div class="wr-fill draws" :style="{ width: drawPercent + '%' }"></div>
          <div class="wr-fill losses" :style="{ width: lossPercent + '%' }"></div>
        </div>
      </div>

      <!-- Статистика vs бот (отдельно) -->
      <template v-if="isOwnProfile && botStats">
        <h3 class="section-title">
          🤖 {{ $t('profile.botStats') }}
          <span class="section-note">{{ $t('profile.botNote') }}</span>
        </h3>
        <div class="stats-grid bot-stats">
          <div class="stat-card">
            <div class="stat-value">{{ botStats.games_played }}</div>
            <div class="stat-label">{{ $t('profile.games') }}</div>
          </div>
          <div class="stat-card wins">
            <div class="stat-value">{{ botStats.games_won }}</div>
            <div class="stat-label">{{ $t('profile.wins') }}</div>
          </div>
          <div class="stat-card losses">
            <div class="stat-value">{{ botStats.games_lost }}</div>
            <div class="stat-label">{{ $t('profile.losses') }}</div>
          </div>
          <div class="stat-card draws">
            <div class="stat-value">{{ botStats.games_drawn }}</div>
            <div class="stat-label">{{ $t('profile.draws') }}</div>
          </div>
        </div>
        <div class="win-rate-bar" v-if="botStats.games_played > 0">
          <div class="wr-label">{{ $t('profile.winRate') }}: {{ botStats.win_rate }}%</div>
        </div>
      </template>

      <!-- История онлайн -->
      <div class="games-history">
        <h2>{{ $t('profile.historyOnline') }}</h2>
        <div v-for="game in onlineGames" :key="game.id" class="game-item" @click="goToAnalysis(game)">
          <div class="game-result-dot" :class="getResultClass(game)"></div>
          <div class="game-players">
            <span>{{ game.white_player?.username }}</span>
            <span class="vs">vs</span>
            <span>{{ game.black_player?.username }}</span>
          </div>
          <div class="game-tc">{{ formatTimeControl(game.time_control) }}</div>
          <div class="game-rating-change" :class="getRatingChangeClass(game)">
            {{ getRatingChangeText(game) }}
          </div>
        </div>
        <div v-if="!onlineGames.length" class="no-games">Партий пока нет</div>
      </div>

      <!-- История vs бот -->
      <div v-if="isOwnProfile" class="games-history">
        <h2>🤖 {{ $t('profile.historyBot') }}</h2>
        <div v-for="game in botGames" :key="game.id" class="game-item" @click="goToAnalysis(game)">
          <div class="game-result-dot" :class="getResultClass(game)"></div>
          <div class="game-players">
            <span>{{ getBotWhiteName(game) }}</span>
            <span class="vs">vs</span>
            <span>{{ getBotBlackName(game) }}</span>
          </div>
          <div class="game-tc">skill {{ game.skill_level }}</div>
          <div class="game-rating-change bot-badge">🤖</div>
        </div>
        <div v-if="!botGames.length" class="no-games">Партий vs бот пока нет</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/useAuthStore';
import axios from '@/plugins/axios';

const route     = useRoute();
const router    = useRouter();
const authStore = useAuthStore();

const user        = ref(null);
const onlineGames = ref([]);
const botGames    = ref([]);
const botStats    = ref(null);
const loading     = ref(true);

const isOwnProfile = computed(() => !route.params.username);
const profileUserId = computed(() => user.value?.id);

onMounted(async () => {
  const username = route.params.username;
  try {
    if (username) {
      const { data } = await axios.get(`/api/users/${username}/`);
      user.value = data;
    } else {
      await authStore.fetchUser();
      user.value = authStore.user;
    }
    const { data } = await axios.get('/api/games/');
    let games = data.results || data;
    if (username) {
      games = games.filter(g =>
        g.white_player?.username === username || g.black_player?.username === username
      );
    }
    onlineGames.value = games.slice(0, 10);

    if (isOwnProfile.value) {
      const [{ data: botData }, { data: stats }] = await Promise.all([
        axios.get('/api/games/bot/'),
        axios.get('/api/games/bot/stats/'),
      ]);
      botGames.value = (botData || []).slice(0, 10).map(g => ({ ...g, isBot: true }));
      botStats.value = stats;
    }
  } finally {
    loading.value = false;
  }
});

// Вычисляем проценты для полосы
const winPercent  = computed(() => user.value ? (user.value.games_won   / user.value.games_played * 100) : 0);
const drawPercent = computed(() => user.value ? (user.value.games_drawn / user.value.games_played * 100) : 0);
const lossPercent = computed(() => user.value ? (user.value.games_lost  / user.value.games_played * 100) : 0);

function formatTimeControl(tc) {
  return tc ? tc.replace(/_/g, '+') : '';
}

function getBotWhiteName(game) {
  const bot = `🤖 Stockfish ${game.skill_level}`;
  return game.player_color === 'white' ? user.value?.username : bot;
}

function getBotBlackName(game) {
  const bot = `🤖 Stockfish ${game.skill_level}`;
  return game.player_color === 'black' ? user.value?.username : bot;
}

function getResultClass(game) {
  if (game.isBot) {
    if (game.result === 'draw') return 'draw';
    const won = (game.result === 'white_win' && game.player_color === 'white')
      || (game.result === 'black_win' && game.player_color === 'black');
    return won ? 'win' : 'loss';
  }
  const uid = profileUserId.value;
  const isWhite = game.white_player?.id === uid;
  if (game.result === 'draw') return 'draw';
  const win = (game.result === 'white_win' && isWhite) || (game.result === 'black_win' && !isWhite);
  return win ? 'win' : 'loss';
}

function getRatingChangeClass(game) {
  if (game.isBot) return '';
  const uid = profileUserId.value;
  const isWhite = game.white_player?.id === uid;
  const change = isWhite ? game.white_rating_change : game.black_rating_change;
  if (!change) return '';
  return change > 0 ? 'positive' : change < 0 ? 'negative' : '';
}

function getRatingChangeText(game) {
  const uid = profileUserId.value;
  const isWhite = game.white_player?.id === uid;
  const change = isWhite ? game.white_rating_change : game.black_rating_change;
  if (change === null) return '';
  return change > 0 ? `+${Math.round(change)}` : Math.round(change);
}

function goToAnalysis(game) {
  if (game.isBot) {
    router.push({ path: '/analysis/bot', query: { id: game.id } });
  } else {
    router.push(`/analysis/${game.id}`);
  }
}
</script>

<style scoped>
.profile-view {
  max-width: 600px;
  margin: 0 auto;
  padding: 1.5rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.profile-header {
  display: flex;
  align-items: center;
  gap: 1.2rem;
}
.profile-avatar {
  width: 80px; height: 80px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--color-surface);
  display: flex; align-items: center; justify-content: center;
}
.profile-avatar img { width: 100%; height: 100%; object-fit: cover; }
.avatar-big { font-size: 2rem; font-weight: 700; color: var(--color-accent); }
.profile-username { font-size: 1.5rem; font-weight: 700; }
.profile-badges { display: flex; gap: 0.5rem; margin-top: 0.3rem; }
.badge {
  font-size: 0.75rem;
  padding: 2px 8px;
  background: var(--color-surface);
  border-radius: 12px;
  color: var(--color-text-muted);
}
.badge.online { color: #10b981; }

.section-title {
  font-size: 0.95rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.section-note {
  font-size: 0.7rem;
  font-weight: 400;
  color: var(--color-text-muted);
}
.bot-stats { opacity: 0.95; }
.bot-badge { font-size: 0.85rem; opacity: 0.7; }

/* Рейтинг */
.rating-card {
  text-align: center;
  padding: 1.5rem;
  background: linear-gradient(135deg, rgba(102,126,234,0.15), rgba(118,75,162,0.15));
  border: 1px solid rgba(102,126,234,0.3);
  border-radius: var(--radius-lg);
}
.rating-value { font-size: 3rem; font-weight: 800; color: var(--color-accent); }
.rating-label { color: var(--color-text-muted); font-size: 0.9rem; }
.rating-rd    { font-size: 0.8rem; color: var(--color-text-muted); margin-top: 4px; }

/* Статистика */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
}
.stat-card {
  text-align: center;
  padding: 1rem 0.5rem;
  background: var(--color-surface);
  border-radius: var(--radius-md);
}
.stat-value { font-size: 1.5rem; font-weight: 700; }
.stat-label { font-size: 0.7rem; color: var(--color-text-muted); margin-top: 2px; }
.stat-card.wins .stat-value    { color: var(--color-success); }
.stat-card.losses .stat-value  { color: var(--color-danger); }
.stat-card.draws .stat-value   { color: #94a3b8; }

/* Полоса */
.wr-track {
  display: flex;
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
  background: var(--color-surface2);
  margin: 0.4rem 0;
}
.wr-fill { transition: width 0.5s ease; }
.wr-fill.wins   { background: var(--color-success); }
.wr-fill.draws  { background: #94a3b8; }
.wr-fill.losses { background: var(--color-danger); }
.wr-legend { display: flex; gap: 1rem; font-size: 0.75rem; }
.wr-legend .wins   { color: var(--color-success); }
.wr-legend .draws  { color: #94a3b8; }
.wr-legend .losses { color: var(--color-danger); }

/* История */
.games-history h2 { font-size: 1rem; font-weight: 600; margin-bottom: 0.75rem; }
.game-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.75rem;
  background: var(--color-surface);
  border-radius: var(--radius-sm);
  margin-bottom: 0.4rem;
  cursor: pointer;
  transition: background 0.15s;
}
.game-item:hover { background: var(--color-surface2); }
.game-result-dot {
  width: 10px; height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.game-result-dot.win  { background: var(--color-success); }
.game-result-dot.loss { background: var(--color-danger); }
.game-result-dot.draw { background: #94a3b8; }
.game-players { flex: 1; font-size: 0.85rem; display: flex; gap: 0.4rem; }
.vs { color: var(--color-text-muted); }
.game-tc { font-size: 0.75rem; color: var(--color-text-muted); }
.game-rating-change { font-weight: 600; font-size: 0.85rem; }
.positive { color: var(--color-success); }
.negative { color: var(--color-danger); }
.no-games { text-align: center; color: var(--color-text-muted); padding: 2rem; }
.loading  { text-align: center; padding: 3rem; color: var(--color-text-muted); }
</style>

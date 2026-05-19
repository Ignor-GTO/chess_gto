<template>
  <AdminLayout :title="$t('admin.dashboard')">
    <div v-if="loading" class="loading">{{ $t('admin.loading') }}</div>
    <template v-else-if="stats">
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">{{ stats.users_total }}</div>
          <div class="stat-label">{{ $t('admin.stats.usersTotal') }}</div>
        </div>
        <div class="stat-card accent">
          <div class="stat-value">{{ stats.users_online }}</div>
          <div class="stat-label">{{ $t('admin.stats.usersOnline') }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stats.users_new_today }}</div>
          <div class="stat-label">{{ $t('admin.stats.usersToday') }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stats.games_total }}</div>
          <div class="stat-label">{{ $t('admin.stats.gamesTotal') }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stats.games_active }}</div>
          <div class="stat-label">{{ $t('admin.stats.gamesActive') }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stats.games_today }}</div>
          <div class="stat-label">{{ $t('admin.stats.gamesToday') }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stats.bot_games_total }}</div>
          <div class="stat-label">{{ $t('admin.stats.botGames') }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stats.users_new_week }}</div>
          <div class="stat-label">{{ $t('admin.stats.usersWeek') }}</div>
        </div>
      </div>
    </template>
  </AdminLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from '@/plugins/axios';
import AdminLayout from '@/layouts/AdminLayout.vue';

const stats = ref(null);
const loading = ref(true);

onMounted(async () => {
  try {
    const { data } = await axios.get('/api/admin/stats/');
    stats.value = data;
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
}
.stat-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 1.25rem;
  text-align: center;
}
.stat-card.accent {
  border-color: color-mix(in srgb, var(--color-accent) 40%, var(--color-border));
  background: color-mix(in srgb, var(--color-accent) 8%, var(--color-surface));
}
.stat-value {
  font-size: 2rem;
  font-weight: 800;
  color: var(--color-accent);
  line-height: 1.2;
}
.stat-label {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin-top: 0.35rem;
}
.loading { text-align: center; padding: 3rem; color: var(--color-text-muted); }
</style>

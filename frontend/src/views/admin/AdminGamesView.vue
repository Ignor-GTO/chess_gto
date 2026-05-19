<template>
  <AdminLayout :title="$t('admin.games')">
    <div class="tabs">
      <button
        type="button"
        class="tab"
        :class="{ active: tab === 'online' }"
        @click="switchTab('online')"
      >
        PvP
      </button>
      <button
        type="button"
        class="tab"
        :class="{ active: tab === 'bot' }"
        @click="switchTab('bot')"
      >
        🤖 Bot
      </button>
    </div>

    <div class="toolbar">
      <input
        v-model="search"
        type="search"
        class="search-input"
        :placeholder="$t('admin.searchGames')"
        @input="debouncedLoad"
      />
      <select v-model="filterStatus" class="filter-select" @change="load">
        <option value="">{{ $t('admin.allStatuses') }}</option>
        <option value="waiting">waiting</option>
        <option value="active">active</option>
        <option value="finished">finished</option>
        <option value="aborted">aborted</option>
      </select>
    </div>

    <div v-if="loading" class="loading">{{ $t('admin.loading') }}</div>

    <!-- PvP -->
    <div v-else-if="tab === 'online'" class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>{{ $t('admin.players') }}</th>
            <th>TC</th>
            <th>{{ $t('admin.status') }}</th>
            <th>{{ $t('admin.result') }}</th>
            <th>{{ $t('admin.date') }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="g in games" :key="g.id">
            <td class="mono">{{ g.id.slice(0, 8) }}…</td>
            <td>{{ g.white_username || '?' }} vs {{ g.black_username || '?' }}</td>
            <td>{{ g.time_control }}</td>
            <td><span class="pill">{{ g.status }}</span></td>
            <td>{{ g.result || '—' }}</td>
            <td class="muted">{{ formatDate(g.created_at) }}</td>
            <td>
              <button
                v-if="g.status === 'finished'"
                type="button"
                class="btn-sm"
                @click="recalculate(g.id)"
              >
                Glicko-2
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="!games.length" class="empty">{{ $t('admin.noData') }}</div>
    </div>

    <!-- Bot -->
    <div v-else class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>{{ $t('auth.username') }}</th>
            <th>Skill</th>
            <th>{{ $t('admin.color') }}</th>
            <th>{{ $t('admin.status') }}</th>
            <th>{{ $t('admin.result') }}</th>
            <th>{{ $t('admin.date') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="g in botGames" :key="g.id">
            <td>{{ g.player_username }}</td>
            <td>{{ g.skill_level }}</td>
            <td>{{ g.player_color }}</td>
            <td><span class="pill">{{ g.status }}</span></td>
            <td>{{ g.result || '—' }}</td>
            <td class="muted">{{ formatDate(g.created_at) }}</td>
          </tr>
        </tbody>
      </table>
      <div v-if="!botGames.length" class="empty">{{ $t('admin.noData') }}</div>
    </div>
  </AdminLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from '@/plugins/axios';
import AdminLayout from '@/layouts/AdminLayout.vue';

const tab = ref('online');
const games = ref([]);
const botGames = ref([]);
const loading = ref(true);
const search = ref('');
const filterStatus = ref('');
let debounceTimer = null;

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

async function load() {
  loading.value = true;
  try {
    if (tab.value === 'online') {
      const params = {};
      if (search.value.trim()) params.search = search.value.trim();
      if (filterStatus.value) params.status = filterStatus.value;
      const { data } = await axios.get('/api/admin/games/', { params });
      games.value = data;
    } else {
      const params = {};
      if (filterStatus.value) params.status = filterStatus.value;
      const { data } = await axios.get('/api/admin/bot-games/', { params });
      botGames.value = data;
    }
  } finally {
    loading.value = false;
  }
}

function switchTab(t) {
  tab.value = t;
  load();
}

function debouncedLoad() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(load, 300);
}

async function recalculate(gameId) {
  await axios.post(`/api/admin/games/${gameId}/recalculate-rating/`);
  alert('OK');
}

onMounted(load);
</script>

<style scoped>
.tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}
.tab {
  padding: 0.45rem 1rem;
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
  cursor: pointer;
}
.tab.active {
  background: color-mix(in srgb, var(--color-accent) 15%, var(--color-surface));
  border-color: var(--color-accent);
  color: var(--color-accent);
  font-weight: 600;
}
.toolbar {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}
.search-input, .filter-select {
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 0.9rem;
}
.search-input { flex: 1; min-width: 200px; }
.table-wrap {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow-x: auto;
}
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}
.data-table th {
  text-align: left;
  padding: 0.75rem 1rem;
  background: var(--color-surface2);
  color: var(--color-text-muted);
  font-weight: 600;
  font-size: 0.75rem;
  text-transform: uppercase;
  white-space: nowrap;
}
.data-table td {
  padding: 0.65rem 1rem;
  border-top: 1px solid var(--color-border);
}
.mono { font-family: monospace; font-size: 0.8rem; }
.muted { color: var(--color-text-muted); white-space: nowrap; }
.pill {
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--color-surface2);
}
.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  border-radius: var(--radius-sm);
  background: var(--color-surface2);
  color: var(--color-accent);
  border: 1px solid var(--color-border);
  cursor: pointer;
}
.loading, .empty {
  text-align: center;
  padding: 2rem;
  color: var(--color-text-muted);
}
</style>

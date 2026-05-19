<template>
  <AdminLayout :title="$t('admin.users')">
    <div class="toolbar">
      <input
        v-model="search"
        type="search"
        class="search-input"
        :placeholder="$t('admin.searchUsers')"
        @input="debouncedLoad"
      />
      <select v-model="filterActive" class="filter-select" @change="load">
        <option value="">{{ $t('admin.allUsers') }}</option>
        <option value="true">{{ $t('admin.activeOnly') }}</option>
        <option value="false">{{ $t('admin.blockedOnly') }}</option>
      </select>
    </div>

    <div v-if="loading" class="loading">{{ $t('admin.loading') }}</div>
    <div v-else class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>{{ $t('auth.username') }}</th>
            <th>Email</th>
            <th>{{ $t('profile.rating') }}</th>
            <th>{{ $t('profile.games') }}</th>
            <th>{{ $t('admin.status') }}</th>
            <th>{{ $t('admin.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u.id">
            <td>
              <span class="username">{{ u.username }}</span>
              <span v-if="u.is_staff" class="badge staff">staff</span>
              <span v-if="u.is_online" class="badge online">●</span>
            </td>
            <td class="muted">{{ u.email || '—' }}</td>
            <td>{{ Math.round(u.rating) }}</td>
            <td>{{ u.games_played }}</td>
            <td>
              <span :class="u.is_active ? 'status-ok' : 'status-bad'">
                {{ u.is_active ? $t('admin.active') : $t('admin.blocked') }}
              </span>
            </td>
            <td class="actions">
              <button
                type="button"
                class="btn-sm"
                :class="u.is_active ? 'danger' : 'success'"
                @click="toggleActive(u)"
              >
                {{ u.is_active ? $t('admin.block') : $t('admin.unblock') }}
              </button>
              <button
                v-if="!u.is_staff"
                type="button"
                class="btn-sm"
                @click="makeStaff(u)"
              >
                staff
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="!users.length" class="empty">{{ $t('admin.noData') }}</div>
    </div>
  </AdminLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from '@/plugins/axios';
import AdminLayout from '@/layouts/AdminLayout.vue';

const users = ref([]);
const loading = ref(true);
const search = ref('');
const filterActive = ref('');
let debounceTimer = null;

async function load() {
  loading.value = true;
  try {
    const params = {};
    if (search.value.trim()) params.search = search.value.trim();
    if (filterActive.value) params.is_active = filterActive.value;
    const { data } = await axios.get('/api/admin/users/', { params });
    users.value = data;
  } finally {
    loading.value = false;
  }
}

function debouncedLoad() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(load, 300);
}

async function patchUser(user, payload) {
  await axios.patch(`/api/admin/users/${user.id}/`, payload);
  await load();
}

function toggleActive(user) {
  patchUser(user, { is_active: !user.is_active });
}

function makeStaff(user) {
  if (confirm(`${user.username} → staff?`)) {
    patchUser(user, { is_staff: true });
  }
}

onMounted(load);
</script>

<style scoped>
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
  overflow: hidden;
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
}
.data-table td {
  padding: 0.65rem 1rem;
  border-top: 1px solid var(--color-border);
}
.username { font-weight: 600; }
.muted { color: var(--color-text-muted); }
.badge {
  font-size: 0.65rem;
  padding: 1px 6px;
  border-radius: 8px;
  margin-left: 4px;
}
.badge.staff { background: var(--color-accent); color: #fff; }
.badge.online { color: var(--color-success); }
.status-ok { color: var(--color-success); }
.status-bad { color: var(--color-danger); }
.actions { display: flex; gap: 0.35rem; flex-wrap: wrap; }
.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  border-radius: var(--radius-sm);
  background: var(--color-surface2);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  cursor: pointer;
}
.btn-sm.danger { color: var(--color-danger); border-color: var(--color-danger); }
.btn-sm.success { color: var(--color-success); border-color: var(--color-success); }
.loading, .empty {
  text-align: center;
  padding: 2rem;
  color: var(--color-text-muted);
}
</style>

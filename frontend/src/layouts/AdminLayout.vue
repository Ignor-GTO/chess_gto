<template>
  <div class="admin-layout">
    <aside class="admin-sidebar">
      <div class="sidebar-head">
        <router-link to="/admin" class="sidebar-logo">⚙️ Admin</router-link>
        <router-link to="/lobby" class="back-link">← {{ $t('admin.backToSite') }}</router-link>
      </div>
      <nav class="sidebar-nav">
        <router-link to="/admin" exact-active-class="active" class="nav-item">
          📊 {{ $t('admin.dashboard') }}
        </router-link>
        <router-link to="/admin/users" active-class="active" class="nav-item">
          👥 {{ $t('admin.users') }}
        </router-link>
        <router-link to="/admin/games" active-class="active" class="nav-item">
          ♟ {{ $t('admin.games') }}
        </router-link>
      </nav>
    </aside>
    <div class="admin-body">
      <header class="admin-topbar">
        <h1 class="admin-title">{{ title }}</h1>
        <div class="topbar-right">
          <ThemeSwitcher />
          <span class="admin-user">{{ authStore.user?.username }}</span>
        </div>
      </header>
      <main class="admin-content">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup>
import { useAuthStore } from '@/stores/useAuthStore';
import ThemeSwitcher from '@/components/ui/ThemeSwitcher.vue';

defineProps({
  title: { type: String, default: '' },
});

const authStore = useAuthStore();
</script>

<style scoped>
.admin-layout {
  display: flex;
  min-height: calc(100vh - 0px);
}
.admin-sidebar {
  width: 220px;
  flex-shrink: 0;
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
  padding: 1.25rem 0;
  display: flex;
  flex-direction: column;
}
.sidebar-head {
  padding: 0 1rem 1rem;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: 0.75rem;
}
.sidebar-logo {
  display: block;
  font-weight: 700;
  font-size: 1.1rem;
  color: var(--color-text);
  text-decoration: none;
  margin-bottom: 0.5rem;
}
.back-link {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  text-decoration: none;
}
.back-link:hover { color: var(--color-accent); }
.sidebar-nav { display: flex; flex-direction: column; gap: 2px; padding: 0 0.5rem; }
.nav-item {
  padding: 0.65rem 0.85rem;
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  text-decoration: none;
  font-size: 0.9rem;
  transition: background 0.15s, color 0.15s;
}
.nav-item:hover { background: var(--color-surface2); color: var(--color-text); }
.nav-item.active {
  background: color-mix(in srgb, var(--color-accent) 20%, transparent);
  color: var(--color-accent);
  font-weight: 600;
}
.admin-body { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.admin-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}
.admin-title { font-size: 1.15rem; font-weight: 600; }
.topbar-right { display: flex; align-items: center; gap: 0.75rem; }
.admin-user { font-size: 0.85rem; color: var(--color-text-muted); }
.admin-content { padding: 1.5rem; flex: 1; overflow-x: auto; }

@media (max-width: 768px) {
  .admin-layout { flex-direction: column; }
  .admin-sidebar {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--color-border);
    padding: 0.75rem;
  }
  .sidebar-nav { flex-direction: row; flex-wrap: wrap; }
}
</style>

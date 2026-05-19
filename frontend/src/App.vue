<!-- Корневой компонент приложения -->
<template>
  <div id="app" :data-lang="locale">
    <AppNav v-if="showNav" />

    <main class="app-main">
      <router-view v-slot="{ Component }">
        <transition name="page-fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import AppNav from '@/components/ui/AppNav.vue';

const route = useRoute();
const { locale } = useI18n();

const showNav = computed(() =>
  !route.path.startsWith('/game/') &&
  !route.path.startsWith('/admin') &&
  !route.path.startsWith('/analysis')
);
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
}

html, body {
  height: 100%;
  font-family: 'Inter', system-ui, sans-serif;
  background-color: var(--color-bg);
  color: var(--color-text);
  font-size: 16px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

#app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-main { flex: 1; }

.page-fade-enter-active,
.page-fade-leave-active { transition: opacity 0.2s ease; }
.page-fade-enter-from,
.page-fade-leave-to     { opacity: 0; }

::-webkit-scrollbar       { width: 6px; }
::-webkit-scrollbar-track { background: var(--color-surface); }
::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 3px; }

button {
  font-family: inherit;
  font-size: 0.9rem;
  cursor: pointer;
  border: none;
  border-radius: var(--radius-sm);
  transition: all 0.15s ease;
}
button:disabled { opacity: 0.5; cursor: not-allowed; }

a { color: var(--color-accent); text-decoration: none; }
a:hover { opacity: 0.85; }
</style>

<template>
  <div class="theme-switcher" ref="rootRef">
    <button
      class="theme-btn"
      type="button"
      :title="$t('themes.title')"
      @click="open = !open"
    >
      {{ currentTheme?.icon || '🎨' }}
    </button>
    <div v-if="open" class="theme-menu" @click.stop>
      <div class="theme-menu-title">{{ $t('themes.title') }}</div>
      <button
        v-for="t in themeStore.themeList"
        :key="t.id"
        type="button"
        class="theme-option"
        :class="{ active: themeStore.current === t.id }"
        @click="pick(t.id)"
      >
        <span class="theme-icon">{{ t.icon }}</span>
        <span>{{ $t(t.labelKey) }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useThemeStore } from '@/stores/useThemeStore';
import { THEMES } from '@/plugins/themes';

const themeStore = useThemeStore();
const open = ref(false);
const rootRef = ref(null);

const currentTheme = computed(() => THEMES[themeStore.current]);

function pick(id) {
  themeStore.setTheme(id);
  open.value = false;
}

function onDocClick(e) {
  if (rootRef.value && !rootRef.value.contains(e.target)) {
    open.value = false;
  }
}

onMounted(() => document.addEventListener('click', onDocClick));
onUnmounted(() => document.removeEventListener('click', onDocClick));
</script>

<style scoped>
.theme-switcher {
  position: relative;
}
.theme-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.15s, border-color 0.15s;
}
.theme-btn:hover {
  transform: scale(1.05);
  border-color: var(--color-accent);
}
.theme-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 160px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 0.4rem;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  z-index: 300;
}
.theme-menu-title {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  padding: 0.3rem 0.6rem 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.theme-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.45rem 0.6rem;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text);
  font-size: 0.85rem;
  text-align: left;
  cursor: pointer;
}
.theme-option:hover { background: var(--color-surface2); }
.theme-option.active {
  background: color-mix(in srgb, var(--color-accent) 18%, transparent);
  color: var(--color-accent);
  font-weight: 600;
}
.theme-icon { font-size: 1rem; }
</style>

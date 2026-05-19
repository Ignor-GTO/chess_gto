import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { THEMES, THEME_IDS, DEFAULT_THEME, applyTheme } from '@/plugins/themes';

const STORAGE_KEY = 'theme';

export const useThemeStore = defineStore('theme', () => {
  const current = ref(localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME);

  const themeList = computed(() =>
    THEME_IDS.map((id) => ({
      id,
      icon: THEMES[id].icon,
      labelKey: THEMES[id].labelKey,
    }))
  );

  function init() {
    applyTheme(current.value);
  }

  function setTheme(themeId) {
    if (!THEMES[themeId]) return;
    current.value = themeId;
    localStorage.setItem(STORAGE_KEY, themeId);
    applyTheme(themeId);
  }

  return { current, themeList, init, setTheme };
});

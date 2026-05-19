import { defineStore } from 'pinia';
import { ref } from 'vue';

const STORAGE_KEY = 'chess_sounds';

export const useSoundStore = defineStore('sound', () => {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');

  const enabled = ref(saved.enabled !== false);
  const volume = ref(typeof saved.volume === 'number' ? saved.volume : 0.7);

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      enabled: enabled.value,
      volume: volume.value,
    }));
  }

  function toggle() {
    enabled.value = !enabled.value;
    persist();
  }

  function setVolume(v) {
    volume.value = Math.max(0, Math.min(1, v));
    persist();
  }

  return { enabled, volume, toggle, setVolume };
});

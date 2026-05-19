<template>
  <div class="player-bar" :class="{ 'active': isActive, 'me': isMe }">
    <!-- Аватар -->
    <div class="avatar">
      <span v-if="isBot" class="bot-avatar">🤖</span>
      <img v-else-if="avatarUrl" :src="avatarUrl" :alt="name" />
      <span v-else class="avatar-placeholder">{{ nameInitial }}</span>
    </div>

    <!-- Имя и рейтинг -->
    <div class="player-info">
      <span class="player-name">{{ name || '...' }}</span>
      <span class="player-rating">{{ rating ? Math.round(rating) : '?' }}</span>
    </div>

    <!-- Шахматные часы -->
    <div class="clock" :class="clockClass">
      {{ formatClock(clock) }}
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  name:     { type: String, default: '' },
  rating:   { type: Number, default: null },
  clock:    { type: Number, default: null }, // миллисекунды
  isActive: { type: Boolean, default: false },
  isMe:     { type: Boolean, default: false },
  isBot:    { type: Boolean, default: false },
  avatarUrl:{ type: String, default: '' },
});

const nameInitial = computed(() => (props.name || '?')[0].toUpperCase());

const clockClass = computed(() => {
  if (!props.isActive) return 'clock-idle';
  if (props.clock < 10_000) return 'clock-danger';    // < 10 сек
  if (props.clock < 30_000) return 'clock-warning';   // < 30 сек
  return 'clock-active';
});

function formatClock(ms) {
  if (ms === null || ms === undefined) return '--:--';
  if (ms === Infinity) return '∞';
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  // Если < 10 сек — показываем десятые
  if (ms < 10_000) {
    return `${m}:${String(s).padStart(2, '0')}.${Math.floor((ms % 1000) / 100)}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}
</script>

<style scoped>
.player-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: min(90vw, 560px);
  padding: 0.5rem 0.75rem;
  background: var(--color-surface);
  border-radius: var(--radius-md);
  border: 2px solid transparent;
  transition: border-color 0.2s;
}
.player-bar.active {
  border-color: var(--color-accent);
}
.player-bar.me {
  flex-direction: row-reverse;
}

/* Аватар */
.avatar {
  width: 36px; height: 36px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--color-surface2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  flex-shrink: 0;
}
.avatar img { width: 100%; height: 100%; object-fit: cover; }
.avatar-placeholder { font-weight: 700; color: var(--color-accent); }

/* Имя и рейтинг */
.player-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.player-name { font-weight: 600; font-size: 0.9rem; }
.player-rating { font-size: 0.75rem; color: var(--color-text-muted); }

/* Часы */
.clock {
  font-family: 'Courier New', monospace;
  font-size: 1.4rem;
  font-weight: 700;
  padding: 0.2rem 0.5rem;
  border-radius: var(--radius-sm);
  min-width: 80px;
  text-align: center;
}
.clock-idle    { background: var(--color-surface2); color: var(--color-text-muted); }
.clock-active  { background: #1a2a3a; color: var(--color-text); }
.clock-warning { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
.clock-danger  { background: rgba(239, 68, 68, 0.2); color: #ef4444; animation: blink 0.5s ease-in-out infinite; }

@keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
</style>

<template>
  <teleport to="body">
    <div class="result-overlay">
      <div class="result-modal">
        <!-- Иконка результата -->
        <div class="result-icon">{{ resultIcon }}</div>

        <!-- Заголовок -->
        <h2 class="result-title">{{ resultTitle }}</h2>
        <p class="result-reason">{{ reasonLabel }}</p>

        <!-- Изменение рейтинга -->
        <div v-if="ratingChange !== null" class="rating-change" :class="ratingChangeClass">
          {{ ratingChange > 0 ? '+' : '' }}{{ Math.round(ratingChange) }}
        </div>

        <!-- Кнопки -->
        <div class="result-actions">
          <button @click="$emit('analyze')" class="btn-analyze">
            📊 Разобрать партию
          </button>
          <button @click="$emit('new-game')" class="btn-new-game">
            ▶ Новая игра
          </button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  result:       { type: String, default: null },   // 'white_win' | 'black_win' | 'draw'
  reason:       { type: String, default: null },
  playerColor:  { type: String, default: 'white' },
  ratingChange: { type: Number, default: null },
});

defineEmits(['analyze', 'new-game']);
const { t } = useI18n();

const isWin = computed(() => {
  return (props.result === 'white_win' && props.playerColor === 'white') ||
         (props.result === 'black_win' && props.playerColor === 'black');
});
const isDraw = computed(() => props.result === 'draw');

const resultIcon = computed(() => {
  if (isDraw.value) return '🤝';
  return isWin.value ? '🏆' : '😢';
});

const resultTitle = computed(() => {
  if (isDraw.value) return t('result.draw_result');
  return isWin.value ? t('result.youWin') : t('result.youLose');
});

const reasonLabel = computed(() => {
  if (!props.reason) return '';
  return t(`result.reasons.${props.reason}`, props.reason);
});

const ratingChangeClass = computed(() => {
  if (props.ratingChange === null) return '';
  return props.ratingChange > 0 ? 'positive' : props.ratingChange < 0 ? 'negative' : 'neutral';
});
</script>

<style scoped>
.result-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
  animation: fadeIn 0.3s ease;
}

.result-modal {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 2.5rem 2rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  min-width: 280px;
  animation: slideUp 0.3s ease;
}

.result-icon { font-size: 4rem; }
.result-title { font-size: 1.8rem; font-weight: 700; }
.result-reason { color: var(--color-text-muted); font-size: 0.95rem; }

.rating-change {
  font-size: 1.5rem;
  font-weight: 700;
  padding: 0.3rem 1rem;
  border-radius: var(--radius-sm);
}
.positive { color: var(--color-success); background: rgba(16,185,129,0.1); }
.negative { color: var(--color-danger);  background: rgba(239,68,68,0.1);  }
.neutral  { color: var(--color-text-muted); }

.result-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
  margin-top: 0.5rem;
}

.btn-analyze {
  padding: 0.75rem;
  background: var(--color-surface2);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.15s;
}
.btn-analyze:hover { background: var(--color-border); }

.btn-new-game {
  padding: 0.75rem;
  background: linear-gradient(135deg, var(--color-accent), var(--color-accent2));
  color: white;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-weight: 600;
  transition: opacity 0.15s;
}
.btn-new-game:hover { opacity: 0.9; }

@keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
</style>

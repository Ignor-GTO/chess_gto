<template>
  <div class="analysis-panel" :class="{ embedded }">
    <!-- Ошибка -->
    <div v-if="errorMsg" class="error-block">
      ⚠️ {{ errorMsg }}
      <button @click="startAnalysis" class="btn-retry">Повторить</button>
    </div>

    <!-- Старт (как «Game Review» на Chess.com) -->
    <button
      v-if="!isAnalyzing && !analysisComplete && !errorMsg"
      @click="startAnalysis"
      class="btn-analyze"
      :disabled="!moves.length"
    >
      🎓 Запустить разбор
    </button>

    <!-- Загрузка -->
    <div v-if="engineLoading || isAnalyzing" class="progress-block">
      <div class="progress-label">
        {{ engineLoading ? 'Загрузка Stockfish…' : `Анализ: ${currentMove} / ${totalMoves}` }}
      </div>
      <div class="progress-bar">
        <div
          class="progress-fill"
          :class="{ indeterminate: engineLoading }"
          :style="!engineLoading ? { width: progressPercent + '%' } : undefined"
        />
      </div>
    </div>

    <!-- Обзор после анализа -->
    <template v-if="analysisComplete && !guidedMode">
      <div class="accuracy-row">
        <div class="acc-item">
          <span class="acc-label">♔ Белые</span>
          <span class="acc-value">{{ accuracy.white }}%</span>
        </div>
        <div class="acc-item">
          <span class="acc-label">♚ Чёрные</span>
          <span class="acc-value">{{ accuracy.black }}%</span>
        </div>
      </div>

      <EvalGraph
        v-if="analysisResults.length"
        :results="analysisResults"
        :move-sans="moveSans"
        @jump-to-move="onGraphJump"
      />

      <p v-if="summaryText" class="coach-summary">{{ summaryText }}</p>

      <button
        v-if="keyMoments.length"
        class="btn-start-review"
        @click="startGuidedReview"
      >
        ▶ Начать разбор ({{ keyMoments.length }} ключ. моментов)
      </button>
      <p v-else class="no-key-moments">Серьёзных ошибок не найдено — отличная партия!</p>
    </template>

    <!-- Пошаговый разбор с «тренером» -->
    <template v-if="guidedMode && currentMoment">
      <div class="coach-box">
        <div class="coach-avatar">🎓</div>
        <p class="coach-text">{{ coachComment }}</p>
      </div>
      <div class="guided-progress">
        Момент {{ guidedPointer + 1 }} из {{ keyMoments.length }}
      </div>
      <div class="guided-actions">
        <button class="btn-next" @click="nextMoment">
          {{ guidedPointer >= keyMoments.length - 1 ? 'Завершить' : 'Далее →' }}
        </button>
        <button class="btn-skip" @click="exitGuided">Выйти</button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted, toRaw } from 'vue';
import EvalGraph from './EvalGraph.vue';

const props = defineProps({
  moves: { type: Array, default: () => [] },
  moveSans: { type: Array, default: () => [] },
  playerColor: { type: String, default: 'white' },
  currentMoveIdx: { type: Number, default: 0 },
  embedded: { type: Boolean, default: false },
});

const emit = defineEmits(['jump', 'results']);

const isAnalyzing = ref(false);
const analysisComplete = ref(false);
const engineLoading = ref(false);
const errorMsg = ref('');
const currentMove = ref(0);
const totalMoves = ref(0);
const analysisResults = ref([]);
const accuracy = ref({ white: 0, black: 0 });

const guidedMode = ref(false);
const guidedPointer = ref(0);

let worker = null;

const progressPercent = computed(() =>
  totalMoves.value ? Math.round((currentMove.value / totalMoves.value) * 100) : 0,
);

const playerChar = computed(() => (props.playerColor === 'white' ? 'w' : 'b'));

/** Ключевые моменты для пошагового разбора (как Chess.com Coach) */
const keyMoments = computed(() => {
  if (!analysisResults.value.length) return [];
  const priority = { blunder: 0, mistake: 1, inaccuracy: 2, brilliant: 3, great: 4 };
  return analysisResults.value
    .map((r, i) => ({
      ...r,
      arrayIdx: i,
      fenIdx: i + 1,
      moveNum: Math.floor(i / 2) + 1,
      isPlayerMove: (i % 2 === 0) === (props.playerColor === 'white'),
    }))
    .filter(r => ['blunder', 'mistake', 'inaccuracy', 'brilliant', 'great'].includes(r.classification))
    .filter(r => r.isPlayerMove || r.classification === 'brilliant')
    .sort((a, b) => (priority[a.classification] ?? 9) - (priority[b.classification] ?? 9) || a.fenIdx - b.fenIdx);
});

const currentMoment = computed(() => keyMoments.value[guidedPointer.value] || null);

const summaryText = computed(() => {
  if (!analysisResults.value.length) return '';
  const blunders = analysisResults.value.filter(r => r.classification === 'blunder').length;
  const mistakes = analysisResults.value.filter(r => r.classification === 'mistake').length;
  const playerAcc = props.playerColor === 'white' ? accuracy.value.white : accuracy.value.black;
  if (blunders === 0 && mistakes <= 1) {
    return `Точность ${playerAcc}% — хорошая игра. Разберём ключевые моменты.`;
  }
  return `Точность ${playerAcc}%. Зевков: ${blunders}, ошибок: ${mistakes}. Нажмите «Начать разбор».`;
});

const COACH_MSG = {
  blunder: (m, sans) =>
    `Зевок на ходу ${m.moveNum} (${sans}). Лучше было ${m.bestMove || '—'}.`,
  mistake: (m, sans) =>
    `Ошибка на ходу ${m.moveNum} (${sans}). Рекомендация: ${m.bestMove || '—'}.`,
  inaccuracy: (m, sans) =>
    `Неточность на ходу ${m.moveNum} (${sans}).`,
  brilliant: (m, sans) => `Блестящий ход ${m.moveNum} (${sans})!`,
  great: (m, sans) => `Отличный ход ${m.moveNum} (${sans}).`,
};

const coachComment = computed(() => {
  const m = currentMoment.value;
  if (!m) return '';
  const sans = props.moveSans[m.arrayIdx] || m.uci || '';
  const fn = COACH_MSG[m.classification];
  return fn ? fn(m, sans) : '';
});

watch(analysisResults, (val) => {
  if (val.length) emit('results', val);
}, { deep: true });

function startAnalysis() {
  if (!props.moves.length) return;
  worker?.terminate();
  worker = null;
  guidedMode.value = false;
  isAnalyzing.value = false;
  analysisComplete.value = false;
  engineLoading.value = true;
  errorMsg.value = '';
  analysisResults.value = [];
  currentMove.value = 0;
  totalMoves.value = props.moves.length;

  const movesPlain = toRaw(props.moves).map(m => String(m));
  worker = new Worker(new URL('@/workers/stockfish.worker.js', import.meta.url), { type: 'classic' });
  worker.onmessage = handleWorkerMessage;
  worker.onerror = () => failAnalysis('Stockfish недоступен');
  worker.postMessage({ type: 'init' });
  worker._pendingAnalyze = movesPlain;
}

function failAnalysis(msg) {
  errorMsg.value = msg;
  isAnalyzing.value = false;
  engineLoading.value = false;
  worker?.terminate();
  worker = null;
}

function handleWorkerMessage(event) {
  const { type } = event.data;
  switch (type) {
    case 'ready':
      engineLoading.value = false;
      isAnalyzing.value = true;
      worker.postMessage({ type: 'analyze_game', payload: { moves: worker._pendingAnalyze, depth: 12 } });
      break;
    case 'analysis_progress':
      currentMove.value = event.data.moveIndex + 1;
      analysisResults.value[event.data.moveIndex] = event.data.result;
      break;
    case 'analysis_complete':
      isAnalyzing.value = false;
      analysisComplete.value = true;
      analysisResults.value = event.data.results;
      {
        const whites = event.data.results.filter((_, i) => i % 2 === 0);
        const blacks = event.data.results.filter((_, i) => i % 2 === 1);
        accuracy.value = { white: calcAccuracy(whites), black: calcAccuracy(blacks) };
      }
      emit('results', event.data.results);
      worker?.terminate();
      worker = null;
      break;
    case 'error':
      failAnalysis(event.data.message || 'Ошибка анализа');
      break;
  }
}

function onGraphJump(moveIndex) {
  emit('jump', moveIndex + 1);
}

function startGuidedReview() {
  if (!keyMoments.value.length) return;
  guidedMode.value = true;
  guidedPointer.value = 0;
  emit('jump', keyMoments.value[0].fenIdx);
}

function nextMoment() {
  if (guidedPointer.value >= keyMoments.value.length - 1) {
    exitGuided();
    return;
  }
  guidedPointer.value += 1;
  emit('jump', keyMoments.value[guidedPointer.value].fenIdx);
}

function exitGuided() {
  guidedMode.value = false;
}

function calcAccuracy(moves) {
  if (!moves.length) return 100;
  const avgLoss = moves.reduce((sum, r) => sum + Math.min(r.cpDiff || 0, 200), 0) / moves.length;
  return Math.max(0, Math.round(103.1668 * Math.exp(-0.04354 * avgLoss) - 3.1669));
}

onUnmounted(() => {
  worker?.terminate();
});
</script>

<style scoped>
.analysis-panel {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  padding: 12px 14px;
  color: var(--color-text);
  flex-shrink: 0;
}

.analysis-panel.embedded {
  border-bottom: 1px solid var(--color-border);
  background: transparent;
}

.error-block {
  padding: 0.6rem;
  background: color-mix(in srgb, var(--color-danger) 12%, transparent);
  border: 1px solid var(--color-danger);
  border-radius: var(--radius-sm);
  font-size: 0.82rem;
}

.btn-retry {
  margin-top: 0.35rem;
  padding: 0.3rem 0.65rem;
  font-size: 0.8rem;
  background: var(--color-surface2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.btn-analyze, .btn-start-review {
  width: 100%;
  padding: 0.65rem 1rem;
  background: var(--color-accent);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
}
.btn-analyze:disabled { opacity: 0.4; }

.accuracy-row {
  display: flex;
  gap: 1.5rem;
  justify-content: center;
}
.acc-label { font-size: 0.75rem; color: var(--color-text-muted); display: block; }
.acc-value { font-size: 1.25rem; font-weight: 700; color: var(--color-accent); }

.coach-summary {
  font-size: 0.82rem;
  line-height: 1.45;
  color: var(--color-text-muted);
  margin: 0;
}

.no-key-moments {
  font-size: 0.82rem;
  color: var(--color-text-muted);
  text-align: center;
  margin: 0;
}

.progress-label { font-size: 0.8rem; color: var(--color-text-muted); }
.progress-bar {
  height: 5px;
  background: var(--color-surface2);
  border-radius: 3px;
  overflow: hidden;
  margin-top: 0.35rem;
}
.progress-fill { height: 100%; background: var(--color-accent); transition: width 0.3s; }
.progress-fill.indeterminate { width: 40%; animation: slide 1.2s ease-in-out infinite; }
@keyframes slide {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(350%); }
}

.coach-box {
  display: flex;
  gap: 10px;
  padding: 10px;
  background: var(--color-surface2);
  border-radius: var(--radius-sm);
}
.coach-avatar { font-size: 1.5rem; flex-shrink: 0; }
.coach-text { font-size: 0.85rem; line-height: 1.45; margin: 0; }

.guided-progress {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  text-align: center;
}

.guided-actions {
  display: flex;
  gap: 8px;
}
.btn-next {
  flex: 1;
  padding: 0.55rem;
  background: var(--color-accent);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  font-weight: 600;
}
.btn-skip {
  padding: 0.55rem 0.75rem;
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
}
</style>

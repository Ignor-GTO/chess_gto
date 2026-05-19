<template>
  <div class="analysis-panel">
    <div v-if="errorMsg" class="error-block">
      ⚠️ {{ errorMsg }}
      <button @click="startAnalysis" class="btn-retry">Повторить</button>
    </div>

    <button
      v-if="!isAnalyzing && !analysisComplete && !errorMsg"
      @click="startAnalysis"
      class="btn-analyze"
      :disabled="!moves.length"
    >
      🎓 Запустить разбор
    </button>

    <div v-if="engineLoading" class="progress-block">
      <div class="progress-label">Загрузка движка Stockfish…</div>
      <div class="progress-bar"><div class="progress-fill indeterminate"></div></div>
    </div>

    <div v-if="isAnalyzing" class="progress-block">
      <div class="progress-label">
        Анализ: ход {{ currentMove }} из {{ totalMoves }}
      </div>
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
      </div>
    </div>

    <EvalGraph v-if="analysisResults.length" :results="analysisResults" />

    <div v-if="analysisResults.length" class="moves-list">
      <div
        v-for="(move, idx) in analysisResults"
        :key="idx"
        class="move-item"
        :class="`move-${move.classification}`"
      >
        <span class="move-number">{{ Math.floor(idx / 2) + 1 }}{{ idx % 2 === 0 ? '.' : '...' }}</span>
        <span class="move-san">{{ moveSans[idx] }}</span>
        <span class="move-badge">{{ classificationLabel(move.classification) }}</span>
        <span class="move-eval">{{ formatEval(move.evalCp) }}</span>
      </div>
    </div>

    <div v-if="report" class="report-block">
      <h3>📋 Отчёт</h3>
      <p class="report-text">{{ report }}</p>
      <div class="accuracy-block">
        <div class="accuracy-item">
          <span>♔ Белые</span>
          <span class="accuracy-value">{{ accuracy.white }}%</span>
        </div>
        <div class="accuracy-item">
          <span>♚ Чёрные</span>
          <span class="accuracy-value">{{ accuracy.black }}%</span>
        </div>
      </div>
      <button @click="speakReport" class="btn-tts" :disabled="isSpeaking">
        🔊 {{ isSpeaking ? 'Озвучиваю…' : 'Голосовой отчёт' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onUnmounted, toRaw } from 'vue';
import EvalGraph from './EvalGraph.vue';
import { useTTS } from '@/composables/useTTS';

const props = defineProps({
  moves: { type: Array, default: () => [] },
  moveSans: { type: Array, default: () => [] },
});

const { speak, stop, isSpeaking } = useTTS();

const isAnalyzing = ref(false);
const analysisComplete = ref(false);
const engineLoading = ref(false);
const errorMsg = ref('');
const currentMove = ref(0);
const totalMoves = ref(0);
const analysisResults = ref([]);
const report = ref('');
const accuracy = ref({ white: 0, black: 0 });

let worker = null;

const progressPercent = computed(() =>
  totalMoves.value ? Math.round((currentMove.value / totalMoves.value) * 100) : 0,
);

function startAnalysis() {
  if (!props.moves.length) return;

  worker?.terminate();
  worker = null;

  isAnalyzing.value = false;
  analysisComplete.value = false;
  engineLoading.value = true;
  errorMsg.value = '';
  analysisResults.value = [];
  report.value = '';
  currentMove.value = 0;
  totalMoves.value = props.moves.length;

  const movesPlain = toRaw(props.moves).map(m => String(m));

  worker = new Worker(new URL('@/workers/stockfish.worker.js', import.meta.url), { type: 'classic' });
  worker.onmessage = handleWorkerMessage;
  worker.onerror = () => failAnalysis('Не удалось запустить Stockfish Worker');
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
      worker.postMessage({
        type: 'analyze_game',
        payload: { moves: worker._pendingAnalyze, depth: 12 },
      });
      break;

    case 'analysis_progress':
      currentMove.value = event.data.moveIndex + 1;
      analysisResults.value[event.data.moveIndex] = event.data.result;
      break;

    case 'analysis_complete':
      isAnalyzing.value = false;
      analysisComplete.value = true;
      analysisResults.value = event.data.results;
      report.value = event.data.report;
      {
        const whites = event.data.results.filter((_, i) => i % 2 === 0);
        const blacks = event.data.results.filter((_, i) => i % 2 === 1);
        accuracy.value = { white: calcAccuracy(whites), black: calcAccuracy(blacks) };
      }
      worker?.terminate();
      worker = null;
      break;

    case 'error':
      failAnalysis(event.data.message || 'Ошибка анализа');
      break;
  }
}

async function speakReport() {
  if (!report.value) return;
  await speak(report.value, { lang: 'ru-RU', rate: 0.9 });
}

const LABELS = {
  brilliant: '!!', great: '!', best: '★', excellent: '✓',
  good: '·', book: '📖', inaccuracy: '?!', mistake: '?',
  blunder: '??', forced: '⚡',
};

function classificationLabel(cls) {
  return LABELS[cls] || cls;
}

function formatEval(cp) {
  if (cp === null || cp === undefined) return '';
  const pawns = (cp / 100).toFixed(1);
  return cp > 0 ? `+${pawns}` : pawns;
}

function calcAccuracy(moves) {
  if (!moves.length) return 100;
  const avgLoss = moves.reduce((sum, r) => sum + Math.min(r.cpDiff || 0, 200), 0) / moves.length;
  return Math.max(0, Math.round(103.1668 * Math.exp(-0.04354 * avgLoss) - 3.1669));
}

onUnmounted(() => {
  worker?.terminate();
  stop();
});
</script>

<style scoped>
.analysis-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text);
}

.error-block {
  padding: 0.75rem;
  background: color-mix(in srgb, var(--color-danger) 12%, var(--color-surface));
  border: 1px solid var(--color-danger);
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.btn-retry {
  align-self: flex-start;
  padding: 0.35rem 0.75rem;
  background: var(--color-surface2);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.btn-analyze {
  padding: 0.75rem 1.5rem;
  background: var(--color-accent);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
}
.btn-analyze:hover { opacity: 0.9; }
.btn-analyze:disabled { opacity: 0.4; cursor: not-allowed; }

.progress-label { font-size: 0.85rem; color: var(--color-text-muted); }

.progress-bar {
  height: 6px;
  background: var(--color-surface2);
  border-radius: 3px;
  overflow: hidden;
  margin-top: 0.5rem;
}
.progress-fill {
  height: 100%;
  background: var(--color-accent);
  transition: width 0.3s ease;
}
.progress-fill.indeterminate {
  width: 40%;
  animation: slide 1.2s ease-in-out infinite;
}
@keyframes slide {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(350%); }
}

.move-item {
  display: grid;
  grid-template-columns: 40px 56px 1fr 52px;
  gap: 0.4rem;
  padding: 0.3rem 0.5rem;
  border-radius: 4px;
  font-size: 0.82rem;
}
.move-blunder { background: color-mix(in srgb, var(--color-danger) 15%, transparent); }
.move-mistake { background: color-mix(in srgb, var(--color-warning) 12%, transparent); }
.move-inaccuracy { background: color-mix(in srgb, var(--color-warning) 8%, transparent); }
.move-brilliant { background: color-mix(in srgb, var(--color-accent) 15%, transparent); }
.move-best { background: color-mix(in srgb, var(--color-success) 10%, transparent); }

.report-block {
  background: var(--color-surface2);
  border-radius: var(--radius-sm);
  padding: 1rem;
}
.report-text { line-height: 1.6; color: var(--color-text-muted); font-size: 0.9rem; }

.accuracy-block { display: flex; gap: 2rem; margin: 0.75rem 0; }
.accuracy-value { font-weight: 700; color: var(--color-accent); font-size: 1.1rem; }

.btn-tts {
  padding: 0.5rem 1rem;
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.btn-tts:hover { border-color: var(--color-accent); }
</style>

<template>
  <div class="analysis-panel">
    <!-- Кнопка запуска анализа -->
    <button
      v-if="!isAnalyzing && !analysisComplete"
      @click="startAnalysis"
      class="btn-analyze"
      :disabled="!moves.length"
    >
      🎓 Запустить разбор тренера
    </button>

    <!-- Прогресс анализа -->
    <div v-if="isAnalyzing" class="progress-block">
      <div class="progress-label">
        Анализирую ход {{ currentMove }} из {{ totalMoves }}...
      </div>
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
      </div>
    </div>

    <!-- График оценки -->
    <EvalGraph v-if="analysisResults.length" :results="analysisResults" />

    <!-- Список ходов с классификацией -->
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

    <!-- Текстовый отчёт -->
    <div v-if="report" class="report-block">
      <h3>📋 Отчёт тренера</h3>
      <p class="report-text">{{ report }}</p>

      <!-- Точность -->
      <div class="accuracy-block">
        <div class="accuracy-item">
          <span>♟️ Белые</span>
          <span class="accuracy-value">{{ accuracy.white }}%</span>
        </div>
        <div class="accuracy-item">
          <span>♟️ Чёрные</span>
          <span class="accuracy-value">{{ accuracy.black }}%</span>
        </div>
      </div>

      <!-- Кнопка голосового отчёта -->
      <button @click="speakReport" class="btn-tts" :disabled="isSpeaking">
        🔊 {{ isSpeaking ? 'Озвучиваю...' : 'Голосовой отчёт' }}
      </button>
    </div>
  </div>
</template>

<script setup>
/**
 * AnalysisPanel.vue
 *
 * Компонент анализа партии:
 * 1. Создаёт Web Worker с Stockfish.js
 * 2. Анализирует все ходы партии локально на устройстве
 * 3. Показывает граф оценки, классификацию ходов и текстовый отчёт
 * 4. Вызывает нативный TTS через Capacitor
 */
import { ref, computed, onUnmounted } from 'vue';
import EvalGraph from './EvalGraph.vue';
import { useTTS } from '@/composables/useTTS';

// Props: массив UCI ходов и SAN нотации
const props = defineProps({
  moves: { type: Array, default: () => [] },       // ['e2e4', 'd7d5', ...]
  moveSans: { type: Array, default: () => [] },    // ['e4', 'd5', ...]
});

// TTS composable
const { speak, stop, isSpeaking } = useTTS();

// Состояние
const isAnalyzing = ref(false);
const analysisComplete = ref(false);
const currentMove = ref(0);
const totalMoves = ref(0);
const analysisResults = ref([]);
const report = ref('');
const accuracy = ref({ white: 0, black: 0 });

// Web Worker (создаём при монтировании)
let worker = null;

const progressPercent = computed(() =>
  totalMoves.value ? Math.round((currentMove.value / totalMoves.value) * 100) : 0
);

// ─── Запуск анализа ──────────────────────────────────────────────────────────

function startAnalysis() {
  isAnalyzing.value = true;
  analysisResults.value = [];
  report.value = '';
  currentMove.value = 0;
  totalMoves.value = props.moves.length;

  // Создаём Web Worker
  worker = new Worker(new URL('@/workers/stockfish.worker.js', import.meta.url), { type: 'classic' });

  worker.onmessage = handleWorkerMessage;
  worker.onerror = (err) => {
    console.error('Ошибка Web Worker:', err);
    isAnalyzing.value = false;
  };

  // Инициализируем движок и запускаем анализ
  worker.postMessage({ type: 'init' });
  setTimeout(() => {
    worker.postMessage({
      type: 'analyze_game',
      payload: { moves: props.moves, depth: 16 },
    });
  }, 500); // Ждём инициализации Stockfish WASM
}

// ─── Обработка сообщений от Worker ──────────────────────────────────────────

function handleWorkerMessage(event) {
  const { type } = event.data;

  switch (type) {
    case 'analysis_progress':
      currentMove.value = event.data.moveIndex + 1;
      // Добавляем результат хода по мере анализа (real-time)
      analysisResults.value[event.data.moveIndex] = event.data.result;
      break;

    case 'analysis_complete':
      isAnalyzing.value = false;
      analysisComplete.value = true;
      analysisResults.value = event.data.results;
      report.value = event.data.report;

      // Вычисляем точность из результатов
      const whites = event.data.results.filter((_, i) => i % 2 === 0);
      const blacks = event.data.results.filter((_, i) => i % 2 === 1);
      accuracy.value = {
        white: calcAccuracy(whites),
        black: calcAccuracy(blacks),
      };

      // Освобождаем Worker
      worker?.terminate();
      break;
  }
}

// ─── Голосовой отчёт (TTS через Capacitor) ──────────────────────────────────

async function speakReport() {
  if (!report.value) return;
  await speak(report.value, { lang: 'ru-RU', rate: 0.9 });
}

// ─── Вспомогательные ─────────────────────────────────────────────────────────

const LABELS = {
  brilliant:  '!! Блестящий',
  great:      '!  Отличный',
  best:       '★  Лучший',
  excellent:  '✓  Хороший',
  good:       '·  Нормальный',
  book:       '📖 Теория',
  inaccuracy: '?! Неточность',
  mistake:    '?  Ошибка',
  blunder:    '?? Зевок',
  forced:     '⚡ Вынужденный',
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

// Чистим Worker при уничтожении компонента
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
  background: #1a1a2e;
  border-radius: 12px;
  color: #e0e0e0;
}

.btn-analyze {
  padding: 0.75rem 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  transition: opacity 0.2s;
}
.btn-analyze:hover { opacity: 0.9; }
.btn-analyze:disabled { opacity: 0.5; cursor: not-allowed; }

.progress-bar {
  height: 6px;
  background: #333;
  border-radius: 3px;
  overflow: hidden;
  margin-top: 0.5rem;
}
.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea, #764ba2);
  transition: width 0.3s ease;
}

.move-item {
  display: grid;
  grid-template-columns: 40px 60px 1fr 60px;
  gap: 0.5rem;
  padding: 0.3rem 0.5rem;
  border-radius: 4px;
  font-size: 0.85rem;
}
.move-blunder  { background: rgba(220, 50, 50, 0.2); }
.move-mistake  { background: rgba(220, 130, 30, 0.2); }
.move-inaccuracy { background: rgba(220, 200, 30, 0.15); }
.move-brilliant { background: rgba(100, 220, 200, 0.2); }
.move-best     { background: rgba(100, 200, 100, 0.15); }

.report-block {
  background: #16213e;
  border-radius: 8px;
  padding: 1rem;
}
.report-text { line-height: 1.6; color: #ccc; }

.accuracy-block {
  display: flex;
  gap: 2rem;
  margin: 0.75rem 0;
}
.accuracy-value { font-weight: bold; color: #667eea; font-size: 1.2rem; }

.btn-tts {
  padding: 0.6rem 1.2rem;
  background: #0f3460;
  color: white;
  border: 1px solid #667eea;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}
.btn-tts:hover { background: #1a4a80; }
</style>

<template>
  <div class="analysis-panel" :class="{ embedded }">
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
      <p v-if="usedFallback" class="fallback-note">Анализ упрощённый (Stockfish недоступен)</p>

      <button class="btn-start-review" @click="startGuidedReview">
        ▶ Начать разбор с начала
      </button>
    </template>

    <template v-if="guidedMode && currentStep">
      <div class="review-toolbar">
        <span class="review-step">
          {{ currentStep.kind === 'intro' ? 'Начало партии' : `Ход ${currentStep.fenIdx} / ${moves.length}` }}
        </span>
        <button
          class="btn-voice"
          :class="{ off: !voiceEnabled }"
          @click="voiceEnabled = !voiceEnabled"
          :title="voiceEnabled ? 'Выключить озвучку' : 'Включить озвучку'"
        >
          {{ voiceEnabled ? '🔊' : '🔇' }}
        </button>
      </div>

      <div class="coach-box">
        <div class="coach-avatar">🎓</div>
        <div class="coach-body">
          <span
            v-if="currentStep.classification"
            class="move-badge"
            :class="currentStep.classification"
          >{{ badgeLabel(currentStep.classification) }}</span>
          <p class="coach-text">{{ currentStep.text }}</p>
        </div>
      </div>

      <div class="guided-actions">
        <button class="btn-nav" :disabled="reviewPointer === 0" @click="prevStep">◀</button>
        <button class="btn-next" @click="nextStep">
          {{ reviewPointer >= reviewSteps.length - 1 ? 'Завершить' : 'Далее ▶' }}
        </button>
        <button class="btn-skip" @click="exitGuided">Выйти</button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted, toRaw } from 'vue';
import EvalGraph from './EvalGraph.vue';
import { useStockfishEngine } from '@/composables/useStockfishEngine';
import { useTTS } from '@/composables/useTTS';
import {
  classifyMove,
  calculateAccuracy,
  buildReviewSteps,
  analyzeGameWithBot,
} from '@/utils/gameAnalysis';

const props = defineProps({
  moves: { type: Array, default: () => [] },
  moveSans: { type: Array, default: () => [] },
  playerColor: { type: String, default: 'white' },
  currentMoveIdx: { type: Number, default: 0 },
  embedded: { type: Boolean, default: false },
});

const emit = defineEmits(['jump', 'results', 'review-mode']);

const stockfish = useStockfishEngine();
const { speak, stop } = useTTS();

const isAnalyzing = ref(false);
const analysisComplete = ref(false);
const engineLoading = ref(false);
const errorMsg = ref('');
const usedFallback = ref(false);
const currentMove = ref(0);
const totalMoves = ref(0);
const analysisResults = ref([]);
const accuracy = ref({ white: 0, black: 0 });

const guidedMode = ref(false);
const reviewPointer = ref(0);
const voiceEnabled = ref(true);
let speakingStep = false;

const progressPercent = computed(() =>
  totalMoves.value ? Math.round((currentMove.value / totalMoves.value) * 100) : 0,
);

const reviewSteps = computed(() =>
  buildReviewSteps(analysisResults.value, props.moveSans, props.playerColor),
);

const currentStep = computed(() => reviewSteps.value[reviewPointer.value] || null);

const summaryText = computed(() => {
  if (!analysisResults.value.length) return '';
  const blunders = analysisResults.value.filter(r => r.classification === 'blunder').length;
  const mistakes = analysisResults.value.filter(r => r.classification === 'mistake').length;
  const playerAcc = props.playerColor === 'white' ? accuracy.value.white : accuracy.value.black;
  if (blunders === 0 && mistakes <= 1) {
    return `Точность ${playerAcc}% — хорошая игра. Начнём разбор с первого хода.`;
  }
  return `Точность ${playerAcc}%. Зевков: ${blunders}, ошибок: ${mistakes}. Разберём партию с начала.`;
});

watch(analysisResults, (val) => {
  if (val.length) emit('results', val);
}, { deep: true });

watch(reviewPointer, () => {
  if (guidedMode.value) presentStep();
});

function badgeLabel(c) {
  const labels = {
    blunder: 'Зевок',
    mistake: 'Ошибка',
    inaccuracy: 'Неточность',
    brilliant: 'Блестяще!',
    best: 'Лучший',
    excellent: 'Отлично',
    good: 'Хорошо',
  };
  return labels[c] || c;
}

async function startAnalysis() {
  if (!props.moves.length) return;

  guidedMode.value = false;
  isAnalyzing.value = false;
  analysisComplete.value = false;
  engineLoading.value = true;
  errorMsg.value = '';
  usedFallback.value = false;
  analysisResults.value = [];
  currentMove.value = 0;
  totalMoves.value = props.moves.length;

  const movesPlain = toRaw(props.moves).map(m => String(m));

  let stockfishOk = false;
  try {
    await stockfish.init();
    stockfishOk = true;
  } catch (err) {
    console.warn('Stockfish недоступен:', err);
  }

  engineLoading.value = false;
  isAnalyzing.value = true;

  try {
    const results = stockfishOk
      ? await analyzeWithStockfish(movesPlain)
      : await analyzeWithBot(movesPlain);

    if (!stockfishOk) usedFallback.value = true;
    finishAnalysis(results);
  } catch (err) {
    failAnalysis(String(err.message || 'Ошибка анализа'));
  }
}

async function analyzeWithStockfish(movesPlain) {
  const results = [];
  let prevEvalCp = 0;

  for (let i = 0; i < movesPlain.length; i++) {
    const movesUpTo = movesPlain.slice(0, i + 1);
    const { cp, mate, bestMove } = await stockfish.analyzePosition(movesUpTo, 10);

    const isWhiteMove = i % 2 === 0;
    const normalizedCp = isWhiteMove ? cp : -cp;
    const cpDiff = Math.abs(normalizedCp - prevEvalCp);
    const classification = classifyMove(
      cpDiff,
      normalizedCp,
      prevEvalCp,
      bestMove,
      movesPlain[i],
    );

    const result = {
      moveIndex: i,
      uci: movesPlain[i],
      evalCp: normalizedCp,
      mateCp: mate,
      cpDiff,
      classification,
      bestMove,
    };

    results.push(result);
    prevEvalCp = normalizedCp;
    currentMove.value = i + 1;
    analysisResults.value[i] = result;
  }

  return results;
}

async function analyzeWithBot(movesPlain) {
  return analyzeGameWithBot(movesPlain, (i, _total, result) => {
    currentMove.value = i + 1;
    analysisResults.value[i] = result;
  });
}

function finishAnalysis(results) {
  isAnalyzing.value = false;
  analysisComplete.value = true;
  analysisResults.value = results;
  accuracy.value = calculateAccuracy(results);
  emit('results', results);
}

function failAnalysis(msg) {
  errorMsg.value = msg;
  isAnalyzing.value = false;
  engineLoading.value = false;
  stockfish.destroy();
}

function onGraphJump(moveIndex) {
  emit('jump', moveIndex + 1);
}

function startGuidedReview() {
  if (!reviewSteps.value.length) return;
  guidedMode.value = true;
  reviewPointer.value = 0;
  emit('review-mode', true);
  presentStep();
}

async function presentStep() {
  const step = currentStep.value;
  if (!step || speakingStep) return;

  emit('jump', step.fenIdx);

  if (!voiceEnabled.value) return;

  speakingStep = true;
  try {
    await stop();
    await speak(step.text, { lang: 'ru-RU', rate: 0.95 });
  } catch (_) {
    /* TTS optional */
  } finally {
    speakingStep = false;
  }
}

function nextStep() {
  if (reviewPointer.value >= reviewSteps.value.length - 1) {
    exitGuided();
    return;
  }
  reviewPointer.value += 1;
}

function prevStep() {
  if (reviewPointer.value > 0) reviewPointer.value -= 1;
}

function exitGuided() {
  guidedMode.value = false;
  emit('review-mode', false);
  stop();
}

onUnmounted(() => {
  stop();
  stockfish.destroy();
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

.coach-summary, .fallback-note {
  font-size: 0.82rem;
  line-height: 1.45;
  color: var(--color-text-muted);
  margin: 0;
}
.fallback-note { color: var(--color-warning); font-size: 0.75rem; }

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

.review-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.review-step {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}
.btn-voice {
  background: var(--color-surface2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 4px 8px;
  font-size: 0.9rem;
  cursor: pointer;
}
.btn-voice.off { opacity: 0.5; }

.coach-box {
  display: flex;
  gap: 10px;
  padding: 10px;
  background: var(--color-surface2);
  border-radius: var(--radius-sm);
}
.coach-avatar { font-size: 1.5rem; flex-shrink: 0; }
.coach-body { flex: 1; min-width: 0; }
.coach-text { font-size: 0.85rem; line-height: 1.45; margin: 0.35rem 0 0; }

.move-badge {
  display: inline-block;
  font-size: 0.68rem;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
}
.move-badge.blunder { background: #c0392b; color: #fff; }
.move-badge.mistake { background: #e67e22; color: #fff; }
.move-badge.inaccuracy { background: #f1c40f; color: #333; }
.move-badge.brilliant { background: #27ae60; color: #fff; }
.move-badge.best, .move-badge.excellent { background: #3498db; color: #fff; }
.move-badge.good { background: var(--color-border); color: var(--color-text); }

.guided-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}
.btn-nav {
  width: 36px;
  height: 36px;
  background: var(--color-surface2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.btn-nav:disabled { opacity: 0.35; }
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

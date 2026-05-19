<template>
  <div class="eval-graph-wrapper">
    <canvas ref="canvasRef" :width="canvasWidth" :height="120" />
    <!-- Подсказка при наведении -->
    <div
      v-if="tooltip.visible"
      class="eval-tooltip"
      :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
    >
      <span class="move-san">{{ tooltip.san }}</span>
      <span class="move-eval">{{ tooltip.eval }}</span>
      <span class="move-cls" :class="`cls-${tooltip.classification}`">
        {{ tooltip.classLabel }}
      </span>
    </div>
  </div>
</template>

<script setup>
/**
 * EvalGraph.vue — График изменения оценки по ходу партии
 *
 * - Белая зона (выше 0) = преимущество белых
 * - Чёрная зона (ниже 0) = преимущество чёрных
 * - Точки кликабельны для навигации по позиции
 */
import { ref, watch, onMounted, nextTick } from 'vue';

const props = defineProps({
  results:  { type: Array, default: () => [] }, // из analysisResults
  moveSans: { type: Array, default: () => [] },
});

const emit = defineEmits(['jump-to-move']);

const canvasRef   = ref(null);
const canvasWidth = ref(600);

const tooltip = ref({
  visible: false,
  x: 0, y: 0,
  san: '', eval: '', classification: '', classLabel: '',
});

const LABELS = {
  brilliant: '!! Блестящий', great: '! Отличный', best: '★ Лучший',
  excellent: '✓ Хороший', good: '· Нормальный', book: '📖 Теория',
  inaccuracy: '?! Неточность', mistake: '? Ошибка', blunder: '?? Зевок',
};

// Перерисовываем при изменении данных
watch(() => props.results, () => nextTick(drawGraph), { deep: true });
onMounted(() => {
  updateWidth();
  window.addEventListener('resize', updateWidth);
  drawGraph();
});

function updateWidth() {
  const wrapper = canvasRef.value?.parentElement;
  if (wrapper) canvasWidth.value = wrapper.clientWidth || 600;
  drawGraph();
}

function drawGraph() {
  const canvas = canvasRef.value;
  if (!canvas || !props.results.length) return;

  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const midY = H / 2;

  ctx.clearRect(0, 0, W, H);

  const total = props.results.length;
  const stepX = W / total;

  // Нормализуем оценку: ограничиваем ±600 cp
  const normalize = (cp) => {
    const clamped = Math.max(-600, Math.min(600, cp || 0));
    return midY - (clamped / 600) * midY;
  };

  // Строим путь графика
  const path = props.results.map((r, i) => ({
    x: i * stepX + stepX / 2,
    y: normalize(r.evalCp),
  }));

  // Заливка белой зоны (выше midY)
  ctx.beginPath();
  ctx.moveTo(0, midY);
  path.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(W, midY);
  ctx.closePath();
  ctx.fillStyle = 'rgba(240, 240, 240, 0.85)';
  ctx.fill();

  // Заливка чёрной зоны (ниже midY)
  ctx.beginPath();
  ctx.moveTo(0, midY);
  path.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fillStyle = 'rgba(30, 30, 30, 0.85)';
  ctx.fill();

  // Линия графика
  ctx.beginPath();
  path.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.strokeStyle = '#667eea';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Центральная линия
  ctx.beginPath();
  ctx.moveTo(0, midY);
  ctx.lineTo(W, midY);
  ctx.strokeStyle = 'rgba(150,150,150,0.4)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Точки для зевков и блестящих ходов
  props.results.forEach((r, i) => {
    const p = path[i];
    if (r.classification === 'blunder') {
      drawDot(ctx, p.x, p.y, '#dc3545', 5);
    } else if (r.classification === 'brilliant') {
      drawDot(ctx, p.x, p.y, '#00bfa5', 5);
    } else if (r.classification === 'mistake') {
      drawDot(ctx, p.x, p.y, '#fd7e14', 4);
    }
  });
}

function drawDot(ctx, x, y, color, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 1;
  ctx.stroke();
}

// Клик/наведение для навигации
function onCanvasClick(event) {
  const canvas = canvasRef.value;
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const total = props.results.length;
  const stepX = canvas.width / total;
  const idx = Math.floor(x / stepX);
  if (idx >= 0 && idx < total) {
    emit('jump-to-move', idx);
  }
}

function onCanvasMouseMove(event) {
  const canvas = canvasRef.value;
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const total = props.results.length;
  const stepX = canvas.width / total;
  const idx = Math.min(total - 1, Math.floor(x / stepX));
  const r = props.results[idx];
  if (!r) return;

  const pawns = r.evalCp !== null ? (r.evalCp / 100).toFixed(1) : '?';
  tooltip.value = {
    visible: true,
    x: event.clientX - rect.left,
    y: 10,
    san: props.moveSans[idx] || r.uci,
    eval: r.evalCp > 0 ? `+${pawns}` : pawns,
    classification: r.classification,
    classLabel: LABELS[r.classification] || r.classification,
  };
}

function onCanvasLeave() {
  tooltip.value.visible = false;
}
</script>

<style scoped>
.eval-graph-wrapper {
  position: relative;
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
  background: #111;
}

canvas {
  display: block;
  width: 100%;
  cursor: crosshair;
}

.eval-tooltip {
  position: absolute;
  background: rgba(0,0,0,0.85);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 2px;
  pointer-events: none;
  transform: translateX(-50%);
  white-space: nowrap;
}

.cls-blunder   { color: #dc3545; }
.cls-mistake   { color: #fd7e14; }
.cls-inaccuracy{ color: #ffc107; }
.cls-brilliant { color: #00bfa5; }
.cls-best      { color: #28a745; }
</style>

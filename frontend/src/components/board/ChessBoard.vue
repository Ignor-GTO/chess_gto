<template>
  <div
    class="chess-board-wrapper"
    :class="{ 'flipped': isFlipped }"
    ref="boardRef"
  >
    <!-- Координаты: буквы (a-h) -->
    <div class="coords-bottom">
      <span v-for="f in files" :key="f">{{ f }}</span>
    </div>
    <!-- Координаты: цифры (1-8) -->
    <div class="coords-left">
      <span v-for="r in ranks" :key="r">{{ r }}</span>
    </div>

    <!-- Сетка 8x8 -->
    <div class="board-grid" @mouseleave="hoveredSquare = null">
      <div
        v-for="square in squares"
        :key="square.name"
        class="square"
        :class="[
          square.isLight ? 'sq-light' : 'sq-dark',
          { 'sq-selected':    selectedSquare === square.name },
          { 'sq-legal-move':  legalMoveSquares.includes(square.name) },
          { 'sq-last-move':   lastMove && (lastMove.from === square.name || lastMove.to === square.name) },
          { 'sq-check':       kingInCheckSquare === square.name },
          { 'sq-hovered':     hoveredSquare === square.name },
        ]"
        :data-square="square.name"
        @click="onSquareClick(square.name)"
        @touchstart.prevent="onTouchStart($event, square.name)"
        @touchend.prevent="onTouchEnd($event, square.name)"
        @dragover.prevent
        @drop="onDrop($event, square.name)"
      >
        <!-- Точка легального хода -->
        <div
          v-if="legalMoveSquares.includes(square.name)"
          class="legal-dot"
          :class="{ 'legal-capture': !!getPiece(square.name) }"
        />

        <!-- Фигура -->
        <transition name="piece-move">
          <img
            v-if="getPiece(square.name)"
            :src="getPieceImage(getPiece(square.name))"
            :alt="getPiece(square.name)"
            class="piece"
            :class="{ 'piece-dragging': draggedFrom === square.name }"
            draggable="true"
            @dragstart="onDragStart($event, square.name)"
            @dragend="onDragEnd"
          />
        </transition>
      </div>
    </div>
    <!-- Превращение пешки -->
    <div v-if="pendingPromotion" class="promotion-modal">
      <p>Выберите фигуру</p>
      <div class="promotion-pieces">
        <button
          v-for="p in promotionPieces"
          :key="p"
          @click="confirmPromotion(p)"
          class="promo-btn"
        >
          {{ p === 'q' ? '♕' : p === 'r' ? '♖' : p === 'b' ? '♗' : '♘' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * ChessBoard.vue — Адаптивная шахматная доска
 *
 * Возможности:
 * - Клик для выбора и перемещения фигур
 * - Drag & Drop (мышь)
 * - Touch события (мобильные)
 * - Подсветка легальных ходов, последнего хода, шаха
 * - Поддержка перевёрнутой доски (для чёрных)
 */
import { ref, computed, watch } from 'vue';
import { Chess } from 'chess.js'; // npm install chess.js

const props = defineProps({
  fen: {
    type: String,
    default: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
  },
  playerColor: { type: String, default: 'white' }, // 'white' | 'black'
  lastMove:    { type: Object, default: null },     // { from: 'e2', to: 'e4' }
  isMyTurn:    { type: Boolean, default: false },
  disabled:    { type: Boolean, default: false },   // после окончания игры
});

const emit = defineEmits(['move']); // emit({ from, to, promotion })

// ─── Состояние ───────────────────────────────────────────────────────────────

const boardRef = ref(null);
const selectedSquare = ref(null);
const hoveredSquare = ref(null);
const draggedFrom = ref(null);
const touchStartSquare = ref(null);
const pendingPromotion = ref(null); // { from, to }
const promotionPieces = ['q', 'r', 'b', 'n'];

// Движок chess.js для валидации легальных ходов на клиенте
const chess = ref(new Chess(props.fen));

// Реактивное обновление при смене FEN
watch(() => props.fen, (newFen) => {
  if (typeof newFen !== 'string' || !newFen) return;
  try {
    chess.value = new Chess(newFen);
    selectedSquare.value = null;
  } catch {
    // игнорируем некорректный FEN
  }
});

// ─── Вычисляемые данные ──────────────────────────────────────────────────────

const isFlipped = computed(() => props.playerColor === 'black');

const files = computed(() =>
  isFlipped.value ? ['h','g','f','e','d','c','b','a'] : ['a','b','c','d','e','f','g','h']
);
const ranks = computed(() =>
  isFlipped.value ? ['1','2','3','4','5','6','7','8'] : ['8','7','6','5','4','3','2','1']
);

// Генерируем все 64 клетки в нужном порядке
const squares = computed(() => {
  const result = [];
  for (const rank of ranks.value) {
    for (const file of files.value) {
      const name = file + rank;
      const fileIdx = 'abcdefgh'.indexOf(file);
      const rankIdx = parseInt(rank) - 1;
      result.push({
        name,
        isLight: (fileIdx + rankIdx) % 2 !== 0,
      });
    }
  }
  return result;
});

// Легальные ходы для выбранной фигуры
const legalMoveSquares = computed(() => {
  if (!selectedSquare.value) return [];
  const moves = chess.value.moves({ square: selectedSquare.value, verbose: true });
  return moves.map(m => m.to);
});

// Клетка короля под шахом
const kingInCheckSquare = computed(() => {
  if (!chess.value.inCheck()) return null;
  const color = chess.value.turn();
  const board = chess.value.board();
  for (const row of board) {
    for (const cell of row) {
      if (cell && cell.type === 'k' && cell.color === color) {
        return cell.square;
      }
    }
  }
  return null;
});

// ─── Работа с фигурами ───────────────────────────────────────────────────────

function getPiece(squareName) {
  const piece = chess.value.get(squareName);
  if (!piece) return null;
  return piece.color + piece.type.toUpperCase(); // 'wP', 'bK', etc.
}

// SVG фигуры: набор Cburnett (как на Lichess / Wikimedia)
const PIECE_IMAGES = {};
['w','b'].forEach(color => {
  ['P','N','B','R','Q','K'].forEach(type => {
    PIECE_IMAGES[`${color}${type}`] =
      `/pieces/${color}${type}.svg`;
  });
});

function getPieceImage(pieceCode) {
  return PIECE_IMAGES[pieceCode] || '';
}

// ─── Обработчики кликов ──────────────────────────────────────────────────────

function onSquareClick(squareName) {
  if (props.disabled || !props.isMyTurn) return;

  const piece = getPiece(squareName);
  const turn = chess.value.turn();
  const myColor = props.playerColor === 'white' ? 'w' : 'b';

  // Выбираем свою фигуру
  if (piece && piece.startsWith(myColor) && turn === myColor) {
    selectedSquare.value = squareName;
    return;
  }

  // Делаем ход
  if (selectedSquare.value) {
    tryMove(selectedSquare.value, squareName);
  }
}

function tryMove(from, to, promotion) {
  const piece = chess.value.get(from);
  const isPromotion =
    piece?.type === 'p' &&
    ((piece.color === 'w' && to[1] === '8') ||
     (piece.color === 'b' && to[1] === '1'));

  const move = chess.value.moves({ square: from, verbose: true }).find(m => m.to === to);
  if (!move) {
    selectedSquare.value = null;
    return;
  }

  if (isPromotion && !promotion) {
    pendingPromotion.value = { from, to };
    return;
  }

  emit('move', { from, to, promotion: isPromotion ? (promotion || 'q') : undefined });
  selectedSquare.value = null;
  pendingPromotion.value = null;
}

function confirmPromotion(piece) {
  if (!pendingPromotion.value) return;
  const { from, to } = pendingPromotion.value;
  tryMove(from, to, piece);
}

// ─── Drag & Drop ─────────────────────────────────────────────────────────────

function onDragStart(event, squareName) {
  if (props.disabled || !props.isMyTurn) {
    event.preventDefault();
    return;
  }
  draggedFrom.value = squareName;
  selectedSquare.value = squareName;
  event.dataTransfer.effectAllowed = 'move';
}

function onDragEnd() {
  draggedFrom.value = null;
}

function onDrop(event, targetSquare) {
  if (!draggedFrom.value) return;
  tryMove(draggedFrom.value, targetSquare);
  draggedFrom.value = null;
}

// ─── Touch события (мобильные) ───────────────────────────────────────────────

function onTouchStart(event, squareName) {
  touchStartSquare.value = squareName;
  onSquareClick(squareName);
}

function onTouchEnd(event, squareName) {
  if (touchStartSquare.value && touchStartSquare.value !== squareName) {
    tryMove(touchStartSquare.value, squareName);
  }
  touchStartSquare.value = null;
}
</script>

<style scoped>
.chess-board-wrapper {
  position: relative;
  display: inline-block;
  user-select: none;
  /* Квадратные пропорции */
  width: min(90vw, 90vh, 560px);
  aspect-ratio: 1;
}

.board-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  grid-template-rows: repeat(8, 1fr);
  width: 100%;
  height: 100%;
  border: 3px solid #2c2c3e;
  border-radius: 4px;
  overflow: hidden;
}

.square {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.1s;
}

.sq-light { background-color: #f0d9b5; }
.sq-dark  { background-color: #b58863; }

/* Подсветки */
.sq-selected   { background-color: #f6f669 !important; }
.sq-last-move  { background-color: rgba(246, 246, 105, 0.5) !important; }
.sq-check      { background-color: rgba(220, 30, 30, 0.8) !important; }
.sq-hovered    { filter: brightness(1.1); }

/* Точки легальных ходов */
.legal-dot {
  position: absolute;
  width: 30%;
  height: 30%;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.2);
  pointer-events: none;
  z-index: 2;
}
.legal-dot.legal-capture {
  width: 100%;
  height: 100%;
  background: transparent;
  border: 5px solid rgba(0, 0, 0, 0.2);
  border-radius: 50%;
}

/* Фигуры */
.piece {
  width: 90%;
  height: 90%;
  object-fit: contain;
  position: relative;
  z-index: 3;
  cursor: grab;
  transition: transform 0.05s;
  filter: drop-shadow(1px 2px 3px rgba(0,0,0,0.4));
}
.piece:active { cursor: grabbing; transform: scale(1.1); }
.piece-dragging { opacity: 0.5; }

/* Координаты */
.coords-bottom {
  display: flex;
  justify-content: space-around;
  padding: 2px 0;
  font-size: 0.7rem;
  color: #666;
}
.coords-left {
  position: absolute;
  left: -16px;
  top: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  height: 100%;
  font-size: 0.7rem;
  color: #666;
}

/* Анимация движения фигуры */
.piece-move-enter-active { transition: all 0.15s ease; }
.piece-move-leave-active { transition: all 0.1s ease; }
.piece-move-enter-from   { opacity: 0; transform: scale(0.8); }
.piece-move-leave-to     { opacity: 0; }

/* Мобильная адаптация */
@media (max-width: 480px) {
  .chess-board-wrapper {
    width: 100vw;
  }
  .piece { width: 85%; height: 85%; }
}

.promotion-modal {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.75);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  z-index: 10;
  border-radius: 4px;
}
.promotion-pieces { display: flex; gap: 0.5rem; }
.promo-btn {
  font-size: 2rem;
  width: 3rem;
  height: 3rem;
  border: none;
  border-radius: 8px;
  background: var(--color-surface, #1a1a2e);
  cursor: pointer;
}
.promo-btn:hover { background: var(--color-accent, #667eea); }
</style>

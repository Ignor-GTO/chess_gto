<template>
  <div
    class="chess-board-wrapper"
    :class="{ flipped: isFlipped, fluid, 'no-coords': hideCoords }"
    ref="boardRef"
  >
    <div class="coords-bottom" v-if="!hideCoords">
      <span v-for="f in files" :key="f">{{ f }}</span>
    </div>
    <div class="coords-left" v-if="!hideCoords">
      <span v-for="r in ranks" :key="r">{{ r }}</span>
    </div>

    <div class="board-grid">
      <div
        v-for="square in squares"
        :key="square.name"
        class="square"
        :class="[
          square.isLight ? 'sq-light' : 'sq-dark',
          { 'sq-selected': selectedSquare === square.name },
          { 'sq-legal-move': legalTargetSet.has(square.name) },
          { 'sq-last-move': lastMove && (lastMove.from === square.name || lastMove.to === square.name) },
          { 'sq-check': kingInCheckSquare === square.name },
        ]"
        :data-square="square.name"
        @click="onSquareClick(square.name)"
      >
        <div
          v-if="legalTargetSet.has(square.name)"
          class="legal-dot"
          :class="{ 'legal-capture': !!boardPieces[square.name] }"
        />

        <img
          v-if="boardPieces[square.name]"
          :src="getPieceImage(boardPieces[square.name])"
          :alt="boardPieces[square.name]"
          class="piece"
          draggable="false"
        />
      </div>
    </div>

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
 * ChessBoard.vue — tap/click to move (без HTML5 drag).
 */
import { ref, shallowRef, computed, watch, markRaw } from 'vue';
import { Chess } from 'chess.js';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function isValidFen(fen) {
  return typeof fen === 'string' && fen.trim().split(/\s+/).length === 6;
}

function createChess(fen) {
  const safeFen = isValidFen(fen) ? fen : START_FEN;
  try {
    return markRaw(new Chess(safeFen));
  } catch {
    return markRaw(new Chess(START_FEN));
  }
}

const props = defineProps({
  fen: {
    type: String,
    default: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  },
  playerColor: { type: String, default: 'white' },
  lastMove:    { type: Object, default: null },
  isMyTurn:    { type: Boolean, default: false },
  disabled:    { type: Boolean, default: false },
  /** Вписать доску в ширину родителя (для анализа и боковой панели) */
  fluid:       { type: Boolean, default: false },
  /** Без координат снаружи — компактный режим анализа */
  hideCoords:  { type: Boolean, default: false },
});

const emit = defineEmits(['move']);

const selectedSquare = ref(null);
const legalTargets = ref([]);
const pendingPromotion = ref(null);
const promotionPieces = ['q', 'r', 'b', 'n'];

// chess.js ломается внутри Vue reactive Proxy — только shallowRef + markRaw
const chess = shallowRef(createChess(props.fen));

const legalTargetSet = computed(() => new Set(legalTargets.value));

const boardPieces = computed(() => {
  const map = {};
  for (const row of chess.value.board()) {
    for (const cell of row) {
      if (cell) map[cell.square] = cell.color + cell.type.toUpperCase();
    }
  }
  return map;
});

watch(() => props.fen, (newFen) => {
  if (!isValidFen(newFen)) return;
  try {
    chess.value = createChess(newFen);
    selectedSquare.value = null;
    legalTargets.value = [];
    pendingPromotion.value = null;
  } catch {
    // ignore invalid FEN
  }
});

const isFlipped = computed(() => props.playerColor === 'black');

const files = computed(() =>
  isFlipped.value ? ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'] : ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
);
const ranks = computed(() =>
  isFlipped.value ? ['1', '2', '3', '4', '5', '6', '7', '8'] : ['8', '7', '6', '5', '4', '3', '2', '1'],
);

const squares = computed(() => {
  const result = [];
  for (const rank of ranks.value) {
    for (const file of files.value) {
      const name = file + rank;
      const fileIdx = 'abcdefgh'.indexOf(file);
      const rankIdx = parseInt(rank, 10) - 1;
      result.push({
        name,
        isLight: (fileIdx + rankIdx) % 2 !== 0,
      });
    }
  }
  return result;
});

const kingInCheckSquare = computed(() => {
  if (!chess.value.inCheck()) return null;
  const color = chess.value.turn();
  for (const row of chess.value.board()) {
    for (const cell of row) {
      if (cell && cell.type === 'k' && cell.color === color) {
        return cell.square;
      }
    }
  }
  return null;
});

const PIECE_IMAGES = {};
['w', 'b'].forEach(color => {
  ['P', 'N', 'B', 'R', 'Q', 'K'].forEach(type => {
    PIECE_IMAGES[`${color}${type}`] = `/pieces/${color}${type}.svg`;
  });
});

function getPieceImage(pieceCode) {
  return PIECE_IMAGES[pieceCode] || '';
}

function myColorChar() {
  return props.playerColor === 'white' ? 'w' : 'b';
}

function canInteract() {
  return !props.disabled && props.isMyTurn && !pendingPromotion.value;
}

function clearSelection() {
  selectedSquare.value = null;
  legalTargets.value = [];
}

function selectSquare(squareName) {
  selectedSquare.value = squareName;
  try {
    const moves = chess.value.moves({ square: squareName, verbose: true });
    legalTargets.value = moves.map(m => m.to);
  } catch {
    legalTargets.value = [];
  }
}

function onSquareClick(squareName) {
  if (!canInteract()) return;

  const piece = boardPieces.value[squareName];
  const turn = chess.value.turn();
  const myColor = myColorChar();

  if (selectedSquare.value === squareName) {
    clearSelection();
    return;
  }

  if (piece && piece.startsWith(myColor) && turn === myColor) {
    selectSquare(squareName);
    return;
  }

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
    clearSelection();
    return;
  }

  if (isPromotion && !promotion) {
    pendingPromotion.value = { from, to };
    return;
  }

  emit('move', { from, to, promotion: isPromotion ? (promotion || 'q') : undefined });
  clearSelection();
  pendingPromotion.value = null;
}

function confirmPromotion(piece) {
  if (!pendingPromotion.value) return;
  const { from, to } = pendingPromotion.value;
  pendingPromotion.value = null;
  tryMove(from, to, piece);
}
</script>

<style scoped>
.chess-board-wrapper {
  position: relative;
  display: block;
  user-select: none;
  -webkit-user-select: none;
  touch-action: manipulation;
  width: min(90vw, 90vh, 560px);
  max-width: 100%;
  aspect-ratio: 1;
}

.chess-board-wrapper.fluid {
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
}

.chess-board-wrapper.fluid.no-coords {
  display: flex;
  flex-direction: column;
}

.chess-board-wrapper.fluid.no-coords .board-grid {
  flex: 1;
  min-height: 0;
}

.board-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  grid-template-rows: repeat(8, 1fr);
  width: 100%;
  height: 100%;
  border: 3px solid var(--board-border, #403d39);
  border-radius: 4px;
  overflow: hidden;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.25);
}

.square {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.sq-light { background-color: var(--board-light, #ebecd0); }
.sq-dark  { background-color: var(--board-dark, #739552); }

.sq-selected   { background-color: var(--board-selected, #f6f669) !important; }
.sq-last-move  { background-color: var(--board-last-move, rgba(155, 199, 0, 0.41)) !important; }
.sq-check      { background-color: var(--board-check, rgba(220, 50, 50, 0.75)) !important; }

.legal-dot {
  position: absolute;
  width: 28%;
  height: 28%;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.18);
  pointer-events: none;
  z-index: 2;
}
.legal-dot.legal-capture {
  width: 88%;
  height: 88%;
  background: transparent;
  border: 4px solid rgba(0, 0, 0, 0.18);
  border-radius: 50%;
}

.piece {
  width: 90%;
  height: 90%;
  object-fit: contain;
  position: relative;
  z-index: 3;
  pointer-events: none;
  -webkit-user-drag: none;
  user-select: none;
  filter: drop-shadow(1px 2px 3px rgba(0, 0, 0, 0.4));
}

.coords-bottom {
  display: flex;
  justify-content: space-around;
  padding: 2px 0;
  font-size: 0.7rem;
  color: var(--color-text-muted);
}
.coords-left {
  position: absolute;
  left: 0;
  top: 0;
  transform: translateX(calc(-100% - 2px));
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  height: 100%;
  font-size: 0.7rem;
  color: var(--color-text-muted);
}

@media (max-width: 480px) {
  .chess-board-wrapper { width: 100vw; }
  .piece { width: 85%; height: 85%; }
}

.promotion-modal {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
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

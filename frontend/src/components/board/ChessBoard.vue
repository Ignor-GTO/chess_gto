<template>
  <div
    class="chess-board-wrapper"
    :class="{ flipped: isFlipped }"
    ref="boardRef"
  >
    <div class="coords-bottom">
      <span v-for="f in files" :key="f">{{ f }}</span>
    </div>
    <div class="coords-left">
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
          { 'sq-legal-move': legalMoveSet.has(square.name) },
          { 'sq-last-move': lastMove && (lastMove.from === square.name || lastMove.to === square.name) },
          { 'sq-check': kingInCheckSquare === square.name },
        ]"
        :data-square="square.name"
        @click="onSquareClick(square.name)"
      >
        <div
          v-if="legalMoveSet.has(square.name)"
          class="legal-dot"
          :class="{ 'legal-capture': !!getPiece(square.name) }"
        />

        <img
          v-if="getPiece(square.name)"
          :src="getPieceImage(getPiece(square.name))"
          :alt="getPiece(square.name)"
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
import { ref, computed, watch } from 'vue';
import { Chess } from 'chess.js';

const props = defineProps({
  fen: {
    type: String,
    default: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  },
  playerColor: { type: String, default: 'white' },
  lastMove:    { type: Object, default: null },
  isMyTurn:    { type: Boolean, default: false },
  disabled:    { type: Boolean, default: false },
});

const emit = defineEmits(['move']);

const selectedSquare = ref(null);
const pendingPromotion = ref(null);
const promotionPieces = ['q', 'r', 'b', 'n'];

const chess = ref(new Chess(props.fen));

watch(() => props.fen, (newFen) => {
  if (typeof newFen !== 'string' || !newFen) return;
  try {
    chess.value = new Chess(newFen);
    selectedSquare.value = null;
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

const legalMoveSet = computed(() => {
  if (!selectedSquare.value) return new Set();
  try {
    const moves = chess.value.moves({ square: selectedSquare.value, verbose: true });
    return new Set(moves.map(m => m.to));
  } catch {
    return new Set();
  }
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

function getPiece(squareName) {
  const piece = chess.value.get(squareName);
  if (!piece) return null;
  return piece.color + piece.type.toUpperCase();
}

function getPieceImage(pieceCode) {
  return PIECE_IMAGES[pieceCode] || '';
}

function myColorChar() {
  return props.playerColor === 'white' ? 'w' : 'b';
}

function canInteract() {
  return !props.disabled && props.isMyTurn && !pendingPromotion.value;
}

function onSquareClick(squareName) {
  if (!canInteract()) return;

  const piece = getPiece(squareName);
  const turn = chess.value.turn();
  const myColor = myColorChar();

  if (selectedSquare.value === squareName) {
    selectedSquare.value = null;
    return;
  }

  if (piece && piece.startsWith(myColor) && turn === myColor) {
    selectedSquare.value = squareName;
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
  pendingPromotion.value = null;
  tryMove(from, to, piece);
}
</script>

<style scoped>
.chess-board-wrapper {
  position: relative;
  display: inline-block;
  user-select: none;
  -webkit-user-select: none;
  touch-action: manipulation;
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
}

.sq-light { background-color: #f0d9b5; }
.sq-dark  { background-color: #b58863; }

.sq-selected   { background-color: #f6f669 !important; }
.sq-last-move  { background-color: rgba(246, 246, 105, 0.5) !important; }
.sq-check      { background-color: rgba(220, 30, 30, 0.8) !important; }

.legal-dot {
  position: absolute;
  width: 30%;
  height: 30%;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.25);
  pointer-events: none;
  z-index: 2;
}
.legal-dot.legal-capture {
  width: 100%;
  height: 100%;
  background: transparent;
  border: 5px solid rgba(0, 0, 0, 0.25);
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

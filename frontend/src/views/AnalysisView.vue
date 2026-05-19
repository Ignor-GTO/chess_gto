<template>
  <div class="analysis-view">
    <div class="analysis-header">
      <button @click="router.back()" class="btn-back">← Назад</button>
      <h1>{{ $t('analysis.title') }}</h1>
      <span class="game-info" v-if="gameInfo">
        {{ gameInfo.white }} vs {{ gameInfo.black }}
      </span>
    </div>

    <div class="analysis-layout">
      <div class="board-column">
        <ChessBoard
          :fen="currentFen"
          player-color="white"
          :last-move="currentLastMove"
          :disabled="true"
          :is-my-turn="false"
          fluid
        />

        <div v-if="captureHint" class="capture-hint">
          {{ captureHint }}
        </div>

        <div class="move-nav">
          <button @click="jumpTo(0)" :disabled="currentMoveIdx === 0" title="В начало">⏮</button>
          <button @click="jumpTo(currentMoveIdx - 1)" :disabled="currentMoveIdx === 0" title="Назад">◀</button>
          <span class="move-counter">{{ currentMoveIdx }} / {{ allFens.length - 1 }}</span>
          <button @click="jumpTo(currentMoveIdx + 1)" :disabled="currentMoveIdx >= allFens.length - 1" title="Вперёд">▶</button>
          <button @click="jumpTo(allFens.length - 1)" :disabled="currentMoveIdx >= allFens.length - 1" title="В конец">⏭</button>
        </div>

        <div class="review-controls">
          <button
            class="btn-review"
            :disabled="!canStepBeforeOpponent"
            @click="stepBeforeOpponent"
            title="Показать позицию до хода соперника"
          >
            ↩ До хода соперника
          </button>
          <button
            class="btn-review"
            :disabled="!canStepAfterOpponent"
            @click="stepAfterOpponent"
            title="Показать ход соперника (взятие)"
          >
            ▶ Ход соперника
          </button>
        </div>
      </div>

      <div class="side-column">
        <MoveList
          :move-sans="moveSans"
          :current-idx="currentMoveIdx"
          @jump="jumpTo"
        />
        <AnalysisPanel :moves="moveUcis" :move-sans="moveSans" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Chess } from 'chess.js';
import axios from '@/plugins/axios';
import { useAuthStore } from '@/stores/useAuthStore';
import ChessBoard from '@/components/board/ChessBoard.vue';
import AnalysisPanel from '@/components/analysis/AnalysisPanel.vue';
import MoveList from '@/components/game/MoveList.vue';

const route  = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const PIECE_LABELS = { p: 'пешку', n: 'коня', b: 'слона', r: 'ладью', q: 'ферзя', k: 'короля' };

const gameInfo       = ref(null);
const moveUcis       = ref([]);
const moveSans       = ref([]);
const moveMeta       = ref([]);
const allFens        = ref([START_FEN]);
const currentMoveIdx = ref(0);
const playerColor    = ref(route.query.color === 'black' ? 'black' : 'white');

const currentFen = computed(() => allFens.value[currentMoveIdx.value] || START_FEN);
const currentLastMove = computed(() => {
  const idx = currentMoveIdx.value;
  if (idx === 0 || !moveUcis.value[idx - 1]) return null;
  const uci = moveUcis.value[idx - 1];
  return { from: uci.slice(0, 2), to: uci.slice(2, 4) };
});

const playerColorChar = computed(() => (playerColor.value === 'white' ? 'w' : 'b'));

const currentMoveMeta = computed(() => {
  const idx = currentMoveIdx.value;
  if (idx === 0) return null;
  return moveMeta.value[idx - 1] || null;
});

const captureHint = computed(() => {
  const meta = currentMoveMeta.value;
  if (!meta?.captured || meta.color === playerColorChar.value) return '';
  const piece = PIECE_LABELS[meta.captured] || meta.captured;
  return `Соперник взял: ${piece}${meta.san.includes('+') ? ' (шах)' : ''}`;
});

const canStepBeforeOpponent = computed(() => {
  const idx = currentMoveIdx.value;
  if (idx === 0) return false;
  const meta = moveMeta.value[idx - 1];
  return meta && meta.color !== playerColorChar.value;
});

const canStepAfterOpponent = computed(() => {
  const idx = currentMoveIdx.value;
  if (idx >= allFens.value.length - 1) return false;
  const meta = moveMeta.value[idx];
  return meta && meta.color !== playerColorChar.value;
});

onMounted(async () => {
  const gameId = route.params.id;
  const queryMoves = route.query.moves;
  const botId = route.query.id;

  if (queryMoves) {
    buildFromUcis(queryMoves.split(',').filter(Boolean));
  } else if (gameId === 'bot' && botId) {
    try {
      const { data } = await axios.get(`/api/games/bot/${botId}/detail/`);
      playerColor.value = data.player_color || playerColor.value;
      gameInfo.value = {
        white: data.player_color === 'white' ? 'Вы' : `🤖 Бот ${data.skill_level}`,
        black: data.player_color === 'black' ? 'Вы' : `🤖 Бот ${data.skill_level}`,
      };
      if (data.pgn) {
        const chess = new Chess();
        chess.loadPgn(data.pgn);
        buildFromUcis(chess.history({ verbose: true }).map(m => m.from + m.to + (m.promotion || '')));
      }
    } catch (err) {
      console.warn('Не удалось загрузить партию vs бот:', err);
    }
  } else if (gameId && gameId !== 'bot') {
    try {
      const { data } = await axios.get(`/api/games/${gameId}/`);
      const meId = authStore.user?.id;
      if (data.white_player?.id === meId) playerColor.value = 'white';
      else if (data.black_player?.id === meId) playerColor.value = 'black';
      gameInfo.value = {
        white: data.white_player?.username,
        black: data.black_player?.username,
      };
      buildFromUcis(data.moves.map(m => m.uci), data.moves.map(m => m.san));
    } catch (err) {
      console.warn('Не удалось загрузить партию:', err);
    }
  }
});

function buildFromUcis(ucis, sans = []) {
  const chess = new Chess();
  const fens = [chess.fen()];
  const sanList = [];
  const metaList = [];

  ucis.forEach((uci, i) => {
    const move = chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci[4] || undefined,
    });
    if (move) {
      fens.push(chess.fen());
      sanList.push(sans[i] || move.san);
      metaList.push({
        san: move.san,
        uci: uci.slice(0, 2) + uci.slice(2, 4) + (move.promotion || ''),
        color: move.color,
        captured: move.captured || null,
      });
    }
  });

  moveUcis.value = ucis;
  moveSans.value = sanList;
  moveMeta.value = metaList;
  allFens.value = fens;
  currentMoveIdx.value = fens.length - 1;
}

function jumpTo(idx) {
  currentMoveIdx.value = Math.max(0, Math.min(idx, allFens.value.length - 1));
}

/** Позиция до хода соперника — видно фигуру до взятия */
function stepBeforeOpponent() {
  if (!canStepBeforeOpponent.value) return;
  jumpTo(currentMoveIdx.value - 1);
}

/** Показать ход соперника — видно взятие */
function stepAfterOpponent() {
  if (!canStepAfterOpponent.value) return;
  jumpTo(currentMoveIdx.value + 1);
}
</script>

<style scoped>
.analysis-view {
  max-width: 920px;
  margin: 0 auto;
  padding: 1rem;
  min-height: 100vh;
  overflow-x: hidden;
}

.analysis-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}
.analysis-header h1 { font-size: 1.25rem; font-weight: 700; }
.game-info { color: var(--color-text-muted); font-size: 0.85rem; margin-left: auto; }

.btn-back {
  padding: 0.4rem 0.8rem;
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.analysis-layout {
  display: grid;
  grid-template-columns: minmax(0, 420px) minmax(0, 1fr);
  gap: 1rem;
  align-items: start;
}

.board-column {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 0;
  width: 100%;
  padding-left: 1rem;
}

.capture-hint {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-warning);
  text-align: center;
  padding: 0.35rem 0.5rem;
  background: color-mix(in srgb, var(--color-warning) 12%, var(--color-surface));
  border-radius: var(--radius-sm);
}

.move-nav {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}
.move-nav button {
  width: 36px; height: 36px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text);
  border-radius: var(--radius-sm);
}
.move-nav button:disabled { opacity: 0.3; }
.move-counter {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  min-width: 4rem;
  text-align: center;
}

.review-controls {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.btn-review {
  flex: 1;
  min-width: 140px;
  padding: 0.45rem 0.6rem;
  font-size: 0.8rem;
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.btn-review:hover:not(:disabled) {
  border-color: var(--color-accent);
  color: var(--color-accent);
}
.btn-review:disabled { opacity: 0.35; cursor: not-allowed; }

.side-column {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-width: 0;
}

@media (max-width: 768px) {
  .analysis-layout { grid-template-columns: 1fr; }
  .board-column { padding-left: 0; max-width: 100%; }
}
</style>

<template>
  <div class="analysis-view">
    <div class="analysis-header">
      <button @click="router.back()" class="btn-back">← Назад</button>
      <h1>{{ $t('analysis.title') }}</h1>
      <span class="game-info" v-if="gameInfo">
        {{ gameInfo.white }} vs {{ gameInfo.black }} · {{ gameInfo.timeControl }}
      </span>
    </div>

    <div class="analysis-layout">
      <!-- Мини-доска -->
      <div class="board-section">
        <ChessBoard
          :fen="currentFen"
          player-color="white"
          :last-move="currentLastMove"
          :disabled="true"
          :is-my-turn="false"
        />
        <!-- Навигация по ходам -->
        <div class="move-nav">
          <button @click="jumpTo(0)"                   :disabled="currentMoveIdx === 0">⏮</button>
          <button @click="jumpTo(currentMoveIdx - 1)"  :disabled="currentMoveIdx === 0">◀</button>
          <button @click="jumpTo(currentMoveIdx + 1)"  :disabled="currentMoveIdx >= allFens.length - 1">▶</button>
          <button @click="jumpTo(allFens.length - 1)"  :disabled="currentMoveIdx >= allFens.length - 1">⏭</button>
        </div>
      </div>

      <!-- Панель анализа -->
      <div class="panel-section">
        <AnalysisPanel
          :moves="moveUcis"
          :move-sans="moveSans"
          ref="analysisPanel"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Chess } from 'chess.js';
import axios from '@/plugins/axios';
import ChessBoard from '@/components/board/ChessBoard.vue';
import AnalysisPanel from '@/components/analysis/AnalysisPanel.vue';

const route  = useRoute();
const router = useRouter();

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const gameInfo      = ref(null);
const moveUcis      = ref([]);
const moveSans      = ref([]);
const allFens       = ref([START_FEN]);
const currentMoveIdx = ref(0);
const isLoaded      = ref(false);

const currentFen = computed(() => allFens.value[currentMoveIdx.value] || START_FEN);
const currentLastMove = computed(() => {
  const idx = currentMoveIdx.value;
  if (idx === 0 || !moveUcis.value[idx - 1]) return null;
  const uci = moveUcis.value[idx - 1];
  return { from: uci.slice(0, 2), to: uci.slice(2, 4) };
});

onMounted(async () => {
  const gameId = route.params.id;
  const queryMoves = route.query.moves;
  const botId = route.query.id;

  if (queryMoves) {
    const ucis = queryMoves.split(',').filter(Boolean);
    buildFromUcis(ucis);
  } else if (gameId === 'bot' && botId) {
    try {
      const { data } = await axios.get(`/api/games/bot/${botId}/detail/`);
      gameInfo.value = {
        white: data.player_color === 'white' ? 'Вы' : `🤖 Бот ${data.skill_level}`,
        black: data.player_color === 'black' ? 'Вы' : `🤖 Бот ${data.skill_level}`,
        timeControl: `bot skill ${data.skill_level}`,
      };
      if (data.pgn) {
        const chess = new Chess();
        chess.loadPgn(data.pgn);
        buildFromUcis(chess.history({ verbose: true }).map(m => m.from + m.to + (m.promotion || '')));
      } else if (data.moves?.length) {
        buildFromUcis(data.moves.map(m => m.uci), data.moves.map(m => m.san));
      }
    } catch (err) {
      console.warn('Не удалось загрузить партию vs бот:', err);
    }
  } else if (gameId && gameId !== 'bot') {
    try {
      const { data } = await axios.get(`/api/games/${gameId}/`);
      gameInfo.value = {
        white: data.white_player?.username,
        black: data.black_player?.username,
        timeControl: data.time_control,
      };
      buildFromUcis(data.moves.map(m => m.uci), data.moves.map(m => m.san));
    } catch (err) {
      console.warn('Не удалось загрузить партию:', err);
    }
  }

  isLoaded.value = true;
});

function buildFromUcis(ucis, sans = []) {
  const chess = new Chess();
  const fens = [chess.fen()];
  const sanList = [];

  ucis.forEach((uci, i) => {
    const from = uci.slice(0, 2);
    const to   = uci.slice(2, 4);
    const promo = uci[4] || undefined;
    const move = chess.move({ from, to, promotion: promo });
    if (move) {
      fens.push(chess.fen());
      sanList.push(sans[i] || move.san);
    }
  });

  moveUcis.value = ucis;
  moveSans.value = sanList;
  allFens.value  = fens;
  currentMoveIdx.value = fens.length - 1;
  isLoaded.value = true;
}

function jumpTo(idx) {
  currentMoveIdx.value = Math.max(0, Math.min(idx, allFens.value.length - 1));
}
</script>

<style scoped>
.analysis-view {
  max-width: 1100px;
  margin: 0 auto;
  padding: 1.5rem 1rem;
}

.analysis-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}
.analysis-header h1 { font-size: 1.4rem; font-weight: 700; }
.game-info { color: var(--color-text-muted); font-size: 0.9rem; margin-left: auto; }

.btn-back {
  padding: 0.4rem 0.8rem;
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.analysis-layout {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 2rem;
  align-items: start;
}

.board-section { display: flex; flex-direction: column; gap: 0.5rem; }
.move-nav {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
}
.move-nav button {
  width: 36px; height: 36px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text);
  border-radius: var(--radius-sm);
  font-size: 1rem;
}
.move-nav button:disabled { opacity: 0.3; }
.move-nav button:hover:not(:disabled) { background: var(--color-surface2); }

@media (max-width: 768px) {
  .analysis-layout {
    grid-template-columns: 1fr;
  }
}
</style>

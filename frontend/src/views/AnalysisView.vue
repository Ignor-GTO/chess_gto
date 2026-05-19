<template>
  <div class="analysis-page">
    <header class="analysis-topbar">
      <button @click="router.back()" class="btn-back">← Назад</button>
      <h1>{{ $t('analysis.title') }}</h1>
      <span v-if="gameInfo" class="game-info">{{ gameInfo.white }} vs {{ gameInfo.black }}</span>
    </header>

    <div class="analysis-body">
      <!-- Левая колонка: доска (как Chess.com) -->
      <section class="board-section">
        <div v-if="gameInfo" class="player-strip player-top">
          <span class="player-dot white"></span>
          <span class="player-name">{{ gameInfo.white }}</span>
        </div>

        <div class="board-frame">
          <ChessBoard
            :fen="currentFen"
            player-color="white"
            :last-move="currentLastMove"
            :disabled="true"
            :is-my-turn="false"
            fluid
            hide-coords
          />
        </div>

        <div v-if="gameInfo" class="player-strip player-bottom">
          <span class="player-dot black"></span>
          <span class="player-name">{{ gameInfo.black }}</span>
        </div>

        <p v-if="captureHint" class="capture-hint">{{ captureHint }}</p>
      </section>

      <!-- Правая колонка: отчёт + ходы + навигация -->
      <aside class="report-panel">
        <div class="panel-head">Отчёт по партии</div>

        <div class="panel-scroll">
          <AnalysisPanel :moves="moveUcis" :move-sans="moveSans" embedded />

          <MoveList
            embedded
            :move-sans="moveSans"
            :current-idx="currentMoveIdx"
            @jump="jumpTo"
          />
        </div>

        <div class="panel-footer">
          <div class="move-nav">
            <button @click="jumpTo(0)" :disabled="currentMoveIdx === 0" title="В начало">⏮</button>
            <button @click="jumpTo(currentMoveIdx - 1)" :disabled="currentMoveIdx === 0" title="Назад">◀</button>
            <span class="move-counter">{{ currentMoveIdx }} / {{ allFens.length - 1 }}</span>
            <button @click="jumpTo(currentMoveIdx + 1)" :disabled="currentMoveIdx >= allFens.length - 1" title="Вперёд">▶</button>
            <button @click="jumpTo(allFens.length - 1)" :disabled="currentMoveIdx >= allFens.length - 1" title="В конец">⏭</button>
          </div>
          <div class="review-row">
            <button class="btn-review" :disabled="!canStepBeforeOpponent" @click="stepBeforeOpponent">
              ↩ До хода соперника
            </button>
            <button class="btn-review" :disabled="!canStepAfterOpponent" @click="stepAfterOpponent">
              ▶ Ход соперника
            </button>
          </div>
        </div>
      </aside>
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
    gameInfo.value = { white: 'Белые', black: 'Чёрные' };
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
        white: data.white_player?.username || 'Белые',
        black: data.black_player?.username || 'Чёрные',
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

function stepBeforeOpponent() {
  if (canStepBeforeOpponent.value) jumpTo(currentMoveIdx.value - 1);
}

function stepAfterOpponent() {
  if (canStepAfterOpponent.value) jumpTo(currentMoveIdx.value + 1);
}
</script>

<style scoped>
.analysis-page {
  min-height: 100vh;
  background: var(--color-bg);
  display: flex;
  flex-direction: column;
}

.analysis-topbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
  flex-shrink: 0;
}

.analysis-topbar h1 {
  font-size: 1rem;
  font-weight: 600;
}

.game-info {
  margin-left: auto;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.btn-back {
  padding: 6px 12px;
  background: var(--color-surface2);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
}

.analysis-body {
  flex: 1;
  display: flex;
  gap: 0;
  min-height: 0;
  overflow: hidden;
}

/* ─── Доска слева ─── */
.board-section {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16px 24px;
  overflow: hidden;
}

.board-frame {
  width: min(100%, calc(100vh - 220px), 640px);
  aspect-ratio: 1;
  flex-shrink: 0;
  max-height: calc(100vh - 220px);
}

.player-strip {
  width: min(100%, calc(100vh - 220px), 640px);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  font-size: 0.9rem;
  font-weight: 500;
}

.player-top { border-radius: var(--radius-sm) var(--radius-sm) 0 0; border-bottom: none; }
.player-bottom { border-radius: 0 0 var(--radius-sm) var(--radius-sm); border-top: none; margin-bottom: 8px; }

.player-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid var(--color-border);
}
.player-dot.white { background: #fff; }
.player-dot.black { background: #222; }

.capture-hint {
  margin-top: 8px;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-warning);
  text-align: center;
}

/* ─── Панель справа (Chess.com style) ─── */
.report-panel {
  flex: 0 0 clamp(300px, 32vw, 380px);
  width: clamp(300px, 32vw, 380px);
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border-left: 1px solid var(--color-border);
  min-height: 0;
}

.panel-head {
  padding: 12px 16px;
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.panel-scroll {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.panel-footer {
  flex-shrink: 0;
  padding: 12px;
  border-top: 1px solid var(--color-border);
  background: var(--color-surface2);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.move-nav {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 6px;
}

.move-nav button {
  width: 36px;
  height: 36px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text);
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
}
.move-nav button:disabled { opacity: 0.3; }

.move-counter {
  font-size: 0.82rem;
  color: var(--color-text-muted);
  min-width: 72px;
  text-align: center;
}

.review-row {
  display: flex;
  gap: 6px;
}

.btn-review {
  flex: 1;
  padding: 8px 6px;
  font-size: 0.75rem;
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}
.btn-review:hover:not(:disabled) { border-color: var(--color-accent); color: var(--color-accent); }
.btn-review:disabled { opacity: 0.35; }

@media (max-width: 860px) {
  .analysis-body { flex-direction: column; overflow-y: auto; }
  .report-panel {
    flex: none;
    width: 100%;
    border-left: none;
    border-top: 1px solid var(--color-border);
    max-height: 50vh;
  }
  .board-section { padding: 12px; }
  .board-frame { width: min(100vw - 24px, 480px); max-height: min(100vw - 24px, 480px); }
  .player-strip { width: min(100vw - 24px, 480px); }
}
</style>

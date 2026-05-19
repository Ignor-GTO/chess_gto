<template>
  <div class="game-view">
    <div class="game-layout">
      <div class="board-column">
        <PlayerBar
          :name="gameStore.opponentName"
          :rating="gameStore.opponentRating"
          :clock="opponentClock"
          :is-active="!gameStore.isMyTurn && gameStore.status === 'active'"
        />

        <ChessBoard
          :fen="gameStore.fen"
          :player-color="gameStore.playerColor"
          :last-move="gameStore.lastMove"
          :is-my-turn="gameStore.isMyTurn"
          :disabled="gameStore.isGameOver"
          fluid
          @move="onMove"
        />

        <PlayerBar
          :name="authStore.user?.username"
          :rating="authStore.user?.rating"
          :clock="myClock"
          :is-active="gameStore.isMyTurn && gameStore.status === 'active'"
          :is-me="true"
        />

        <div class="game-controls">
          <button @click="gameStore.resign()" :disabled="gameStore.isGameOver" class="btn-danger">🏳 Сдаться</button>
          <button @click="gameStore.offerDraw()" :disabled="gameStore.isGameOver" class="btn-secondary">🤝 Ничья</button>
        </div>
      </div>

      <aside class="side-panel">
        <MoveList :move-sans="gameStore.moveSans" :current-idx="gameStore.moves.length" />
      </aside>
    </div>

    <div v-if="gameStore.drawOffered" class="draw-offer-modal">
      <p>Соперник предлагает ничью</p>
      <button @click="gameStore.acceptDraw()" class="btn-primary">Принять</button>
      <button @click="gameStore.rejectDraw()" class="btn-secondary">Отклонить</button>
    </div>

    <GameResultModal
      v-if="gameStore.isGameOver"
      :result="gameStore.result"
      :reason="gameStore.resultReason"
      :rating-change="myRatingChange"
      @analyze="goToAnalysis"
      @new-game="startNewGame"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useGameStore } from '@/stores/useGameStore';
import { useAuthStore } from '@/stores/useAuthStore';
import ChessBoard from '@/components/board/ChessBoard.vue';
import PlayerBar from '@/components/game/PlayerBar.vue';
import MoveList from '@/components/game/MoveList.vue';
import GameResultModal from '@/components/game/GameResultModal.vue';
import axios from '@/plugins/axios';

const route  = useRoute();
const router = useRouter();
const gameStore = useGameStore();
const authStore = useAuthStore();

onMounted(async () => {
  const gameId = route.params.id;
  const { data } = await axios.get(`/api/games/${gameId}/`);
  const meId = authStore.user?.id;
  const color = data.white_player?.id === meId ? 'white' : 'black';
  gameStore.hydrateFromApi(data, color);
  gameStore.connect(gameId, color);
});

onUnmounted(() => gameStore.disconnect());

watch(() => gameStore.isGameOver, async (over) => {
  if (!over || !gameStore.gameId) return;
  for (let i = 0; i < 8; i++) {
    await new Promise(r => setTimeout(r, 1500));
    try {
      const { data } = await axios.get(`/api/games/${gameStore.gameId}/`);
      if (data.white_rating_change != null || data.black_rating_change != null) {
        gameStore.hydrateFromApi(data, gameStore.playerColor);
        break;
      }
    } catch {}
  }
});

const myClock = computed(() =>
  gameStore.playerColor === 'white' ? gameStore.whiteClock : gameStore.blackClock,
);
const opponentClock = computed(() =>
  gameStore.playerColor === 'white' ? gameStore.blackClock : gameStore.whiteClock,
);
const myRatingChange = computed(() => gameStore.myRatingChange);

function onMove({ from, to, promotion }) {
  gameStore.sendMove(from, to, promotion);
}

function goToAnalysis() {
  router.push(`/analysis/${gameStore.gameId}`);
}

function startNewGame() {
  gameStore.reset();
  router.push('/lobby');
}
</script>

<style scoped>
.game-view {
  min-height: 100vh;
  background: var(--color-bg);
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.game-layout {
  display: grid;
  grid-template-columns: minmax(280px, 560px) 240px;
  gap: 1rem;
  align-items: start;
  width: 100%;
  max-width: 860px;
}

.board-column {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  align-items: center;
}

.side-panel { min-width: 0; }

.game-controls { display: flex; gap: 0.75rem; margin-top: 0.25rem; }

.btn-danger {
  padding: 0.5rem 1rem;
  background: var(--color-danger);
  color: white;
  border-radius: var(--radius-sm);
}
.btn-secondary, .btn-primary {
  padding: 0.5rem 1rem;
  border-radius: var(--radius-sm);
}
.btn-secondary {
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}
.btn-primary {
  background: var(--color-accent);
  color: white;
}

.draw-offer-modal {
  position: fixed;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  box-shadow: 0 8px 32px rgba(0,0,0,0.3);
  z-index: 50;
}

@media (max-width: 720px) {
  .game-layout { grid-template-columns: 1fr; }
  .side-panel { order: -1; max-height: 160px; }
}
</style>

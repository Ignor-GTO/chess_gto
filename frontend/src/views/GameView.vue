<template>
  <div class="game-view">
    <!-- Верхняя панель: соперник -->
    <PlayerBar
      :name="gameStore.opponentName"
      :rating="gameStore.opponentRating"
      :clock="opponentClock"
      :is-active="!gameStore.isMyTurn && gameStore.status === 'active'"
    />

    <!-- Шахматная доска -->
    <ChessBoard
      :fen="gameStore.fen"
      :player-color="gameStore.playerColor"
      :last-move="gameStore.lastMove"
      :is-my-turn="gameStore.isMyTurn"
      :disabled="gameStore.isGameOver"
      @move="onMove"
    />

    <!-- Нижняя панель: игрок -->
    <PlayerBar
      :name="authStore.user?.username"
      :rating="authStore.user?.rating"
      :clock="myClock"
      :is-active="gameStore.isMyTurn && gameStore.status === 'active'"
      :is-me="true"
    />

    <!-- Кнопки управления -->
    <div class="game-controls">
      <button @click="gameStore.resign()" :disabled="gameStore.isGameOver" class="btn-danger">
        🏳 Сдаться
      </button>
      <button
        @click="gameStore.offerDraw()"
        :disabled="gameStore.isGameOver"
        class="btn-secondary"
      >
        🤝 Ничья
      </button>
    </div>

    <!-- Предложение ничьей -->
    <div v-if="gameStore.drawOffered" class="draw-offer-modal">
      <p>Соперник предлагает ничью</p>
      <button @click="gameStore.acceptDraw()" class="btn-primary">Принять</button>
      <button @click="gameStore.rejectDraw()" class="btn-secondary">Отклонить</button>
    </div>

    <!-- Результат партии -->
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
import GameResultModal from '@/components/game/GameResultModal.vue';
import axios from '@/plugins/axios';

const route  = useRoute();
const router = useRouter();
const gameStore = useGameStore();
const authStore = useAuthStore();

// Определяем цвет и подключаемся
onMounted(async () => {
  const gameId = route.params.id;
  const { data } = await axios.get(`/api/games/${gameId}/`);
  const meId = authStore.user?.id;
  const color = data.white_player?.id === meId ? 'white' : 'black';
  gameStore.hydrateFromApi(data, color);
  gameStore.connect(gameId, color);
});

onUnmounted(() => {
  gameStore.disconnect();
});

// Ждём Celery: подтягиваем изменение рейтинга после партии
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

// Часы: мои и соперника
const myClock = computed(() =>
  gameStore.playerColor === 'white' ? gameStore.whiteClock : gameStore.blackClock
);
const opponentClock = computed(() =>
  gameStore.playerColor === 'white' ? gameStore.blackClock : gameStore.whiteClock
);

// Изменение рейтинга после партии
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
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  min-height: 100vh;
  background: #0f0f1a;
  padding: 1rem;
}

.game-controls {
  display: flex;
  gap: 1rem;
  margin-top: 0.5rem;
}

.btn-danger {
  padding: 0.5rem 1rem;
  background: #c0392b;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.btn-secondary {
  padding: 0.5rem 1rem;
  background: #2c3e50;
  color: white;
  border: 1px solid #4a5568;
  border-radius: 6px;
  cursor: pointer;
}
.btn-primary {
  padding: 0.5rem 1rem;
  background: #27ae60;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.draw-offer-modal {
  background: #1a2a3a;
  border: 1px solid #4a5568;
  border-radius: 8px;
  padding: 1rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
</style>

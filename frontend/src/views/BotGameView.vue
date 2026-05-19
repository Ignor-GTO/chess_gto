<template>
  <!-- Страница игры против бота (без WebSocket) -->
  <div class="game-view">
    <!-- Соперник: бот -->
    <PlayerBar
      :name="botName"
      :rating="botRating"
      :clock="botClock"
      :is-active="!game.isMyTurn.value && !game.isGameOver.value"
      :is-bot="true"
    />

    <!-- Доска -->
    <ChessBoard
      :fen="game.fen.value"
      :player-color="game.playerColor.value"
      :last-move="game.lastMove.value"
      :is-my-turn="game.isMyTurn.value"
      :disabled="game.isGameOver.value"
      @move="onPlayerMove"
    />

    <!-- Мой таймер -->
    <PlayerBar
      :name="authStore.user?.username"
      :rating="authStore.user?.rating"
      :clock="playerClock"
      :is-active="game.isMyTurn.value"
      :is-me="true"
    />

    <!-- Индикатор "Бот думает..." -->
    <div v-if="game.isBotThinking.value" class="bot-thinking">
      <span class="thinking-dots">🤖 Бот думает</span>
    </div>

    <!-- Контролы -->
    <div class="game-controls">
      <button @click="game.resign()" :disabled="game.isGameOver.value" class="btn-danger">
        🏳 Сдаться
      </button>
      <button @click="newGame" class="btn-secondary">
        🔄 Новая игра
      </button>
    </div>

    <!-- Результат -->
    <GameResultModal
      v-if="game.isGameOver.value"
      :result="game.result.value"
      :reason="game.resultReason.value"
      :player-color="game.playerColor.value"
      :rating-change="null"
      @analyze="goToAnalysis"
      @new-game="newGame"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/useAuthStore';
import { useBotGame } from '@/composables/useBotGame';
import ChessBoard from '@/components/board/ChessBoard.vue';
import PlayerBar from '@/components/game/PlayerBar.vue';
import GameResultModal from '@/components/game/GameResultModal.vue';

const route     = useRoute();
const router    = useRouter();
const authStore = useAuthStore();
const game      = useBotGame();

// Параметры из query: /game/bot?skill=10&color=white
const skill = Number(route.query.skill ?? 10);
const color = route.query.color || 'white';

// Часы (бот без ограничения времени — только для отображения)
const playerClock = ref(null);
const botClock    = ref(null);

// Информация о боте
const botName   = computed(() => `🤖 Stockfish ${game.skillConfig.value.label}`);
const botRating = computed(() => {
  const ratings = { 0: 800, 5: 1200, 10: 1600, 15: 2000, 20: 2500 };
  return ratings[game.skillLevel.value] || 1500;
});

onMounted(() => {
  game.startGame(color, skill);
});

function onPlayerMove({ from, to, promotion }) {
  game.playerMove(from, to, promotion);
}

function goToAnalysis() {
  router.push({
    path: '/analysis/bot',
    query: { moves: game.moveUcis.value.join(',') },
  });
}

function newGame() {
  game.cleanup();
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
  background: var(--color-bg);
  padding: 1rem;
}

.bot-thinking {
  font-size: 0.9rem;
  color: var(--color-text-muted);
  height: 1.5rem;
}

.thinking-dots::after {
  content: '';
  animation: dots 1.5s steps(3, end) infinite;
}
@keyframes dots {
  0%   { content: ''; }
  33%  { content: '.'; }
  66%  { content: '..'; }
  100% { content: '...'; }
}

.game-controls {
  display: flex;
  gap: 1rem;
}
.btn-danger {
  padding: 0.5rem 1rem;
  background: var(--color-danger);
  color: white;
  border-radius: var(--radius-sm);
}
.btn-secondary {
  padding: 0.5rem 1rem;
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}
</style>

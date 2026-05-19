<template>
  <div class="game-view">
    <PlayerBar
      :name="botName"
      :rating="botRating"
      :clock="Infinity"
      :is-active="!isMyTurn && !isGameOver"
      :is-bot="true"
    />

    <div v-if="!isGameOver" class="turn-indicator" :class="{ 'my-turn': isMyTurn }">
      {{ turnLabel }}
    </div>

    <ChessBoard
      :fen="fen"
      :player-color="playerColor"
      :last-move="lastMove"
      :is-my-turn="isMyTurn && !isBotThinking"
      :disabled="isGameOver || isBotThinking"
      @move="onPlayerMove"
    />

    <PlayerBar
      :name="authStore.user?.username"
      :rating="authStore.user?.rating"
      :clock="Infinity"
      :is-active="isMyTurn && !isGameOver"
      :is-me="true"
    />

    <div class="game-controls">
      <button @click="game.resign()" :disabled="isGameOver" class="btn-danger">
        🏳 Сдаться
      </button>
      <button @click="newGame" class="btn-secondary">
        🔄 Новая игра
      </button>
    </div>

    <GameResultModal
      v-if="isGameOver"
      :result="result"
      :reason="resultReason"
      :player-color="playerColor"
      :rating-change="null"
      @analyze="goToAnalysis"
      @new-game="newGame"
    />
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/useAuthStore';
import { useBotGame } from '@/composables/useBotGame';
import ChessBoard from '@/components/board/ChessBoard.vue';
import PlayerBar from '@/components/game/PlayerBar.vue';
import GameResultModal from '@/components/game/GameResultModal.vue';

const route  = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const game = useBotGame();

const skill = Number(route.query.skill ?? 10);
const color = route.query.color || 'white';

const fen = computed(() => game.fen.value);
const lastMove = computed(() => game.lastMove.value);
const playerColor = computed(() => game.playerColor.value);
const skillLevel = computed(() => game.skillLevel.value);
const isMyTurn = computed(() => game.isMyTurn.value);
const isGameOver = computed(() => game.isGameOver.value);
const isBotThinking = computed(() => game.isBotThinking.value);
const result = computed(() => game.result.value);
const resultReason = computed(() => game.resultReason.value);
const turnLabel = computed(() => game.turnLabel.value);
const moveUcis = computed(() => game.moveUcis.value);

const botName = computed(() => `🤖 Бот ${game.skillConfig.value.label}`);
const botRating = computed(() => {
  const ratings = { 0: 800, 5: 1200, 10: 1600, 15: 2000, 20: 2500 };
  return ratings[skillLevel.value] || 1500;
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
    query: { moves: moveUcis.value.join(',') },
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

.turn-indicator {
  font-size: 0.95rem;
  font-weight: 600;
  padding: 0.35rem 1rem;
  border-radius: 999px;
  background: var(--color-surface);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
}
.turn-indicator.my-turn {
  color: var(--color-accent);
  border-color: var(--color-accent);
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

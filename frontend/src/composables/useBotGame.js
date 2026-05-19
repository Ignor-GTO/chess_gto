/**
 * useBotGame.js — Composable для игры против Stockfish бота.
 *
 * Полностью офлайн — WebSocket не нужен.
 * Бот делает ход через botWorker.js (WASM в отдельном потоке).
 */
import { ref, computed, onUnmounted } from 'vue';
import { Chess } from 'chess.js';
import axios from '@/plugins/axios';

// Уровни сложности с временем обдумывания
export const SKILL_CONFIGS = {
  0:  { label: '🐣 Новичок',   movetime: 100,  skillLevel: 0  },
  5:  { label: '🙂 Любитель',  movetime: 300,  skillLevel: 5  },
  10: { label: '😐 Средний',   movetime: 600,  skillLevel: 10 },
  15: { label: '😤 Сильный',   movetime: 1000, skillLevel: 15 },
  20: { label: '🤖 Эксперт',   movetime: 2000, skillLevel: 20 },
};

export function useBotGame() {
  // ─── Состояние ─────────────────────────────────────────────────────────────
  const chess        = ref(new Chess());
  const fen          = ref(chess.value.fen());
  const moves        = ref([]);        // { uci, san }[]
  const lastMove     = ref(null);
  const playerColor  = ref('white');   // игрок всегда выбирает цвет
  const skillLevel   = ref(10);
  const isMyTurn     = ref(true);
  const isGameOver   = ref(false);
  const result       = ref(null);      // 'white_win' | 'black_win' | 'draw'
  const resultReason = ref(null);
  const isBotThinking = ref(false);

  let botWorker = null;
  let gameId    = null;  // ID партии в БД

  // ─── Вычисляемые ───────────────────────────────────────────────────────────
  const skillConfig  = computed(() => SKILL_CONFIGS[skillLevel.value] || SKILL_CONFIGS[10]);
  const moveSans     = computed(() => moves.value.map(m => m.san));
  const moveUcis     = computed(() => moves.value.map(m => m.uci));

  // ─── Инициализация ─────────────────────────────────────────────────────────

  function startGame(color = 'white', skill = 10) {
    playerColor.value = color;
    skillLevel.value = skill;
    chess.value = new Chess();
    fen.value = chess.value.fen();
    moves.value = [];
    lastMove.value = null;
    isGameOver.value = false;
    result.value = null;
    resultReason.value = null;
    isMyTurn.value = color === 'white'; // белые ходят первыми

    // Создаём Web Worker (classic — importScripts для Stockfish)
    botWorker = new Worker(new URL('@/workers/botWorker.js', import.meta.url), { type: 'classic' });
    botWorker.onmessage = handleBotMessage;
    botWorker.postMessage({ type: 'init', payload: { skillLevel: skill } });

    // Если играем за чёрных — бот ходит первым
    if (color === 'black') {
      setTimeout(requestBotMove, 600);
    }

    // Создаём запись в БД
    createGameRecord();
  }

  // ─── Ход игрока ────────────────────────────────────────────────────────────

  function playerMove(from, to, promotion = 'q') {
    if (!isMyTurn.value || isGameOver.value) return false;

    const moveObj = chess.value.move({ from, to, promotion });
    if (!moveObj) return false;

    const uci = from + to + (moveObj.promotion || '');
    applyMove(uci, moveObj.san);

    isMyTurn.value = false;
    checkGameOver();

    if (!isGameOver.value) {
      // Бот думает
      isBotThinking.value = true;
      requestBotMove();
    }

    return true;
  }

  // ─── Запрос хода у бота ────────────────────────────────────────────────────

  function requestBotMove() {
    if (!botWorker || isGameOver.value) return;
    botWorker.postMessage({
      type: 'get_move',
      payload: {
        moves: moveUcis.value,
        movetime: skillConfig.value.movetime,
      },
    });
  }

  function handleBotMessage(event) {
    const { type, uci } = event.data;
    if (type !== 'bot_move') return;

    isBotThinking.value = false;

    // Применяем ход бота
    const from = uci.slice(0, 2);
    const to   = uci.slice(2, 4);
    const promo = uci[4] || undefined;

    const moveObj = chess.value.move({ from, to, promotion: promo });
    if (!moveObj) return;

    applyMove(uci, moveObj.san);
    isMyTurn.value = true;
    checkGameOver();
    saveMoves();
  }

  // ─── Применение хода (обновление состояния) ────────────────────────────────

  function applyMove(uci, san) {
    fen.value = chess.value.fen();
    lastMove.value = { from: uci.slice(0, 2), to: uci.slice(2, 4) };
    moves.value.push({ uci, san });
  }

  // ─── Проверка конца партии ─────────────────────────────────────────────────

  function checkGameOver() {
    const c = chess.value;
    if (c.isCheckmate()) {
      isGameOver.value = true;
      const winnersColor = c.turn() === 'w' ? 'black' : 'white'; // ходит проигравший
      result.value = winnersColor === 'white' ? 'white_win' : 'black_win';
      resultReason.value = 'checkmate';
      finalizeGame();
    } else if (c.isStalemate()) {
      endDraw('stalemate');
    } else if (c.isInsufficientMaterial()) {
      endDraw('insufficient_material');
    } else if (c.isThreefoldRepetition()) {
      endDraw('threefold_repetition');
    } else if (c.isDraw()) {
      endDraw('50_moves');
    }
  }

  function endDraw(reason) {
    isGameOver.value = true;
    result.value = 'draw';
    resultReason.value = reason;
    finalizeGame();
  }

  function resign() {
    if (isGameOver.value) return;
    isGameOver.value = true;
    result.value = playerColor.value === 'white' ? 'black_win' : 'white_win';
    resultReason.value = 'resign';
    finalizeGame();
  }

  // ─── Сохранение в БД ───────────────────────────────────────────────────────

  async function createGameRecord() {
    try {
      const { data } = await axios.post('/api/games/bot/create/', {
        skill_level: skillLevel.value,
        player_color: playerColor.value,
      });
      gameId = data.id;
    } catch (err) {
      console.warn('Не удалось создать запись партии vs бот:', err);
    }
  }

  async function saveMoves() {
    if (!gameId) return;
    try {
      await axios.patch(`/api/games/bot/${gameId}/`, {
        pgn: chess.value.pgn(),
        current_fen: chess.value.fen(),
      });
    } catch {}
  }

  async function finalizeGame() {
    botWorker?.postMessage({ type: 'stop' });
    if (!gameId) return;
    try {
      await axios.patch(`/api/games/bot/${gameId}/`, {
        pgn: chess.value.pgn(),
        status: 'finished',
        result: result.value,
        result_reason: resultReason.value,
      });
    } catch {}
  }

  // ─── Очистка ───────────────────────────────────────────────────────────────

  function cleanup() {
    botWorker?.terminate();
    botWorker = null;
  }

  onUnmounted(cleanup);

  return {
    // State
    fen, moves, lastMove, moveUcis, moveSans,
    playerColor, skillLevel, skillConfig,
    isMyTurn, isGameOver, result, resultReason, isBotThinking,
    // Actions
    startGame, playerMove, resign, cleanup,
    SKILL_CONFIGS,
  };
}

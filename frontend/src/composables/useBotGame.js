/**
 * useBotGame.js — игра против локального бота (chess.js).
 */
import { ref, computed, onUnmounted } from 'vue';
import { Chess } from 'chess.js';
import axios from '@/plugins/axios';
import { pickBotMove } from '@/utils/botEngine';

export const SKILL_CONFIGS = {
  0:  { label: '🐣 Новичок',   movetime: 200,  skillLevel: 0  },
  5:  { label: '🙂 Любитель',  movetime: 400,  skillLevel: 5  },
  10: { label: '😐 Средний',   movetime: 600,  skillLevel: 10 },
  15: { label: '😤 Сильный',   movetime: 900,  skillLevel: 15 },
  20: { label: '🤖 Эксперт',   movetime: 1200, skillLevel: 20 },
};

export function useBotGame() {
  const chess         = ref(new Chess());
  const fen           = ref(chess.value.fen());
  const moves         = ref([]);
  const lastMove      = ref(null);
  const playerColor   = ref('white');
  const skillLevel    = ref(10);
  const isMyTurn      = ref(true);
  const isGameOver    = ref(false);
  const result        = ref(null);
  const resultReason  = ref(null);
  const isBotThinking = ref(false);

  let gameId = null;
  let botTimer = null;

  const skillConfig = computed(() => SKILL_CONFIGS[skillLevel.value] || SKILL_CONFIGS[10]);
  const moveSans    = computed(() => moves.value.map(m => m.san));
  const moveUcis    = computed(() => moves.value.map(m => m.uci));
  const turnLabel   = computed(() => {
    if (isGameOver.value) return '';
    if (isBotThinking.value) return 'Бот думает…';
    return isMyTurn.value ? 'Ваш ход' : 'Ход бота';
  });

  function clearBotTimer() {
    if (botTimer) {
      clearTimeout(botTimer);
      botTimer = null;
    }
  }

  function startGame(color = 'white', skill = 10) {
    clearBotTimer();

    playerColor.value = color;
    skillLevel.value = skill;
    chess.value = new Chess();
    fen.value = chess.value.fen();
    moves.value = [];
    lastMove.value = null;
    isGameOver.value = false;
    result.value = null;
    resultReason.value = null;
    isMyTurn.value = color === 'white';
    isBotThinking.value = false;

    createGameRecord();

    if (color === 'black') {
      scheduleBotMove();
    }
  }

  function playerMove(from, to, promotion) {
    if (!isMyTurn.value || isGameOver.value || isBotThinking.value) return false;

    const moveInput = { from, to };
    if (promotion) moveInput.promotion = promotion;

    const moveObj = chess.value.move(moveInput);
    if (!moveObj) return false;

    const uci = from + to + (moveObj.promotion || '');
    applyMove(uci, moveObj.san);
    isMyTurn.value = false;
    checkGameOver();

    if (!isGameOver.value) {
      scheduleBotMove();
    }

    return true;
  }

  function scheduleBotMove() {
    if (isGameOver.value || isMyTurn.value) return;

    isBotThinking.value = true;
    clearBotTimer();

    botTimer = setTimeout(() => {
      botTimer = null;
      if (isGameOver.value || isMyTurn.value) {
        isBotThinking.value = false;
        return;
      }

      const choice = pickBotMove(chess.value.fen(), skillLevel.value);
      isBotThinking.value = false;

      if (!choice) {
        isMyTurn.value = true;
        return;
      }

      const moveInput = { from: choice.from, to: choice.to };
      if (choice.promotion) moveInput.promotion = choice.promotion;

      const moveObj = chess.value.move(moveInput);
      if (!moveObj) {
        isMyTurn.value = true;
        return;
      }

      const uci = choice.from + choice.to + (moveObj.promotion || '');
      applyMove(uci, moveObj.san);
      isMyTurn.value = true;
      checkGameOver();
      saveMoves();
    }, skillConfig.value.movetime);
  }

  function applyMove(uci, san) {
    fen.value = chess.value.fen();
    lastMove.value = { from: uci.slice(0, 2), to: uci.slice(2, 4) };
    moves.value.push({ uci, san });
  }

  function checkGameOver() {
    const c = chess.value;
    if (c.isCheckmate()) {
      isGameOver.value = true;
      const winnersColor = c.turn() === 'w' ? 'black' : 'white';
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
    clearBotTimer();
    isBotThinking.value = false;
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

  function cleanup() {
    clearBotTimer();
  }

  onUnmounted(cleanup);

  return {
    fen, moves, lastMove, moveUcis, moveSans,
    playerColor, skillLevel, skillConfig,
    isMyTurn, isGameOver, result, resultReason, isBotThinking, turnLabel,
    startGame, playerMove, resign, cleanup,
    SKILL_CONFIGS,
  };
}

/**
 * useBotGame.js — Composable для игры против Stockfish бота.
 */
import { ref, computed, onUnmounted } from 'vue';
import { Chess } from 'chess.js';
import axios from '@/plugins/axios';

const STOCKFISH_WORKER_URL = '/stockfish/stockfish.js#/stockfish/stockfish.wasm,worker';

export const SKILL_CONFIGS = {
  0:  { label: '🐣 Новичок',   movetime: 100,  skillLevel: 0  },
  5:  { label: '🙂 Любитель',  movetime: 300,  skillLevel: 5  },
  10: { label: '😐 Средний',   movetime: 600,  skillLevel: 10 },
  15: { label: '😤 Сильный',   movetime: 1000, skillLevel: 15 },
  20: { label: '🤖 Эксперт',   movetime: 2000, skillLevel: 20 },
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
  const engineError   = ref(null);

  let botWorker   = null;
  let gameId      = null;
  let engineReady = false;
  let pendingBotMove = false;

  const skillConfig = computed(() => SKILL_CONFIGS[skillLevel.value] || SKILL_CONFIGS[10]);
  const moveSans    = computed(() => moves.value.map(m => m.san));
  const moveUcis    = computed(() => moves.value.map(m => m.uci));
  const turnLabel   = computed(() => {
    if (isGameOver.value) return '';
    if (isBotThinking.value) return 'Бот думает…';
    return isMyTurn.value ? 'Ваш ход' : 'Ход бота';
  });

  function startGame(color = 'white', skill = 10) {
    cleanupWorker();
    engineError.value = null;
    engineReady = false;
    pendingBotMove = false;

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
    isBotThinking.value = color === 'black';

    botWorker = new Worker(STOCKFISH_WORKER_URL);
    botWorker.onmessage = handleEngineLine;
    botWorker.onerror = () => {
      engineError.value = 'Не удалось загрузить движок Stockfish';
      isBotThinking.value = false;
    };
    botWorker.postMessage('uci');

    if (color === 'black') {
      pendingBotMove = true;
    }

    createGameRecord();
  }

  function configureEngine(skill) {
    botWorker?.postMessage(`setoption name Skill Level value ${skill}`);
    if (skill < 5) {
      botWorker?.postMessage('setoption name UCI_LimitStrength value true');
      botWorker?.postMessage(`setoption name UCI_Elo value ${600 + skill * 100}`);
    }
    botWorker?.postMessage('setoption name Threads value 1');
    botWorker?.postMessage('setoption name Hash value 32');
    botWorker?.postMessage('isready');
  }

  function handleEngineLine(event) {
    const line = typeof event.data === 'string' ? event.data : '';
    if (!line) return;

    if (line === 'uciok') {
      configureEngine(skillLevel.value);
      return;
    }

    if (line === 'readyok') {
      engineReady = true;
      if (pendingBotMove) {
        pendingBotMove = false;
        requestBotMove();
      }
      return;
    }

    if (line.startsWith('bestmove')) {
      const uci = line.split(' ')[1];
      if (!uci || uci === '(none)') {
        isBotThinking.value = false;
        engineError.value = 'Бот не смог найти ход';
        return;
      }
      applyBotMove(uci);
    }
  }

  function playerMove(from, to, promotion) {
    if (!isMyTurn.value || isGameOver.value) return false;

    const moveInput = { from, to };
    if (promotion) moveInput.promotion = promotion;

    const moveObj = chess.value.move(moveInput);
    if (!moveObj) return false;

    const uci = from + to + (moveObj.promotion || '');
    applyMove(uci, moveObj.san);

    isMyTurn.value = false;
    checkGameOver();

    if (!isGameOver.value) {
      requestBotMove();
    }

    return true;
  }

  function requestBotMove() {
    if (!botWorker || isGameOver.value || isMyTurn.value) return;

    if (!engineReady) {
      pendingBotMove = true;
      isBotThinking.value = true;
      return;
    }

    isBotThinking.value = true;
    engineError.value = null;

    const history = moveUcis.value.join(' ');
    botWorker.postMessage(
      history ? `position startpos moves ${history}` : 'position startpos',
    );
    botWorker.postMessage(`go movetime ${skillConfig.value.movetime}`);
  }

  function applyBotMove(uci) {
    isBotThinking.value = false;

    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promo = uci[4] || undefined;

    const moveInput = { from, to };
    if (promo) moveInput.promotion = promo;

    const moveObj = chess.value.move(moveInput);
    if (!moveObj) {
      engineError.value = 'Некорректный ход бота';
      isMyTurn.value = true;
      return;
    }

    applyMove(uci, moveObj.san);
    isMyTurn.value = true;
    checkGameOver();
    saveMoves();
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
    isBotThinking.value = false;
    botWorker?.postMessage('stop');
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

  function cleanupWorker() {
    botWorker?.terminate();
    botWorker = null;
    engineReady = false;
    pendingBotMove = false;
  }

  function cleanup() {
    cleanupWorker();
  }

  onUnmounted(cleanup);

  return {
    fen, moves, lastMove, moveUcis, moveSans,
    playerColor, skillLevel, skillConfig,
    isMyTurn, isGameOver, result, resultReason, isBotThinking,
    engineError, turnLabel,
    startGame, playerMove, resign, cleanup,
    SKILL_CONFIGS,
  };
}

/**
 * useGameStore.js — Pinia store для управления игровым состоянием
 *
 * Ключевые принципы:
 *   1. Сервер — источник истины, но клиент НИКОГДА не регрессирует
 *      (число полуходов не должно уменьшаться).
 *   2. Оптимистичный ход применяется сразу и НЕ откатывается
 *      без явной ошибки от сервера.
 *   3. Часы синхронизируются только из move/move_made — game_sync
 *      их обновляет только в большую сторону по ply.
 */
import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { Chess } from 'chess.js';
import axios from '@/plugins/axios';
import { useAuthStore } from './useAuthStore';
import { playMoveSound } from '@/composables/useChessSounds';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const DEBUG = true;
const log = (...args) => DEBUG && console.log('[Game]', new Date().toISOString().slice(11, 23), ...args);

function fenPly(fenStr) {
  if (!fenStr) return -1;
  const parts = fenStr.split(' ');
  if (parts.length < 6) return -1;
  const turn = parts[1];
  const fullmove = parseInt(parts[5], 10);
  if (!Number.isFinite(fullmove)) return -1;
  return (fullmove - 1) * 2 + (turn === 'b' ? 1 : 0);
}

export const useGameStore = defineStore('game', () => {
  const authStore = useAuthStore();

  const gameId       = ref(null);
  const status       = ref('idle');
  const result       = ref(null);
  const resultReason = ref(null);

  const fen          = ref(START_FEN);
  const moves        = ref([]);
  const lastMove     = ref(null);

  const playerColor  = ref('white');
  const opponentName = ref('');
  const opponentRating = ref(0);

  const whiteRatingChange = ref(null);
  const blackRatingChange = ref(null);

  const whiteClock   = ref(300_000);
  const blackClock   = ref(300_000);
  const clockRunning = ref(false);
  let   clockInterval = null;

  const isMyTurn     = ref(false);
  const drawOffered  = ref(false);
  const isConnected  = ref(false);
  const pendingMove  = ref(false);

  let ws = null;
  let wsId = 0;
  let clockTurn = null;
  let connecting = false;
  let manualClose = false;

  const myColor = computed(() => playerColor.value);
  const isGameOver = computed(() => status.value === 'finished');
  const isWaitingForOpponent = computed(() => status.value === 'waiting');
  const canMove = computed(() =>
    status.value === 'active' &&
    isConnected.value &&
    isMyTurn.value &&
    !pendingMove.value &&
    !isGameOver.value,
  );
  const moveSans = computed(() => moves.value.map(m => m.san));
  const moveUcis = computed(() => moves.value.map(m => m.uci));
  const localPly = computed(() => Math.max(moves.value.length, fenPly(fen.value)));

  const myRatingChange = computed(() => {
    if (playerColor.value === 'white') return whiteRatingChange.value;
    return blackRatingChange.value;
  });

  function wsBaseUrl() {
    const base = import.meta.env.VITE_WS_URL || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
    return base.replace(/\/$/, '');
  }

  function setClocks(payload) {
    if (payload.white_clock != null) {
      whiteClock.value = Math.round(payload.white_clock);
    } else if (payload.white_time_remaining != null) {
      whiteClock.value = Math.round(payload.white_time_remaining * 1000);
    }

    if (payload.black_clock != null) {
      blackClock.value = Math.round(payload.black_clock);
    } else if (payload.black_time_remaining != null) {
      blackClock.value = Math.round(payload.black_time_remaining * 1000);
    }
  }

  function applyMovesArray(arr) {
    if (!Array.isArray(arr)) return;

    moves.value = arr.map(m => ({
      uci: m.uci,
      san: m.san,
      fen: m.fen || m.fen_after || null,
    }));

    if (moves.value.length) {
      const last = moves.value[moves.value.length - 1];
      lastMove.value = { from: last.uci.slice(0, 2), to: last.uci.slice(2, 4) };
    } else {
      lastMove.value = null;
    }
  }

  function recomputeTurnFromFen() {
    const turn = fen.value.split(' ')[1];
    isMyTurn.value = (
      (turn === 'w' && playerColor.value === 'white') ||
      (turn === 'b' && playerColor.value === 'black')
    );
    return turn;
  }

  function startOrUpdateClock(turn) {
    if (status.value !== 'active' || isGameOver.value) {
      stopClock();
      return;
    }
    if (turn !== clockTurn) {
      startClock(turn);
    }
  }

  /**
   * Применить полное состояние с сервера, но ТОЛЬКО если оно не регрессивно.
   * Регрессивно = ply сервера < ply локального.
   */
  function applySnapshot(snapshot, sourceTag) {
    const incomingPly = Array.isArray(snapshot.moves)
      ? snapshot.moves.length
      : fenPly(snapshot.fen);
    const local = localPly.value;

    if (incomingPly !== -1 && incomingPly < local) {
      log(`[${sourceTag}] IGNORED stale snapshot (incomingPly=${incomingPly} < localPly=${local})`);
      if (snapshot.status === 'finished') {
        status.value = 'finished';
      }
      return false;
    }

    log(`[${sourceTag}] APPLY snapshot ply=${incomingPly} (local=${local})`);

    if (snapshot.status) {
      status.value = snapshot.status === 'finished' ? 'finished' : snapshot.status;
    }
    if (snapshot.fen) {
      fen.value = snapshot.fen;
    }
    if (Array.isArray(snapshot.moves)) {
      applyMovesArray(snapshot.moves);
    }
    setClocks(snapshot);

    const turn = recomputeTurnFromFen();
    startOrUpdateClock(turn);
    return true;
  }

  /** Первичная загрузка из REST. Вызывается один раз перед connect(). */
  function hydrateFromApi(data, color) {
    gameId.value = data.id;
    playerColor.value = color;
    status.value = data.status === 'finished' ? 'finished' : data.status;
    fen.value = data.current_fen || START_FEN;
    setClocks(data);
    whiteRatingChange.value = data.white_rating_change;
    blackRatingChange.value = data.black_rating_change;
    result.value = data.result;
    resultReason.value = data.result_reason;

    const isWhite = color === 'white';
    const opp = isWhite ? data.black_player : data.white_player;
    if (opp) {
      opponentName.value = opp.username;
      opponentRating.value = Math.round(opp.rating || 0);
    }

    applyMovesArray(data.moves);

    const turn = recomputeTurnFromFen();
    startOrUpdateClock(turn);

    log('hydrateFromApi', { id: data.id, color, status: status.value, fen: fen.value, plies: moves.value.length });
  }

  function connect(id, color) {
    if (ws && gameId.value === id && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      log('connect SKIPPED — already connected/connecting');
      return;
    }

    gameId.value = id;
    playerColor.value = color;
    closeWs(true);

    connecting = true;
    manualClose = false;
    const myWsId = ++wsId;
    const token = authStore.accessToken;
    const wsUrl = `${wsBaseUrl()}/ws/game/${id}/?token=${token}`;
    log('connect →', wsUrl);

    const sock = new WebSocket(wsUrl);
    ws = sock;

    sock.onopen = () => {
      if (sock !== ws) return;
      isConnected.value = true;
      connecting = false;
      log('WS open #' + myWsId);
    };

    sock.onmessage = (event) => {
      if (sock !== ws) {
        log('IGNORED message from stale WS');
        return;
      }
      try {
        const data = JSON.parse(event.data);
        handleMessage(data);
      } catch (err) {
        console.error('[Game] invalid WS message:', err, event.data);
      }
    };

    sock.onclose = (event) => {
      if (sock !== ws) return;
      isConnected.value = false;
      connecting = false;
      log(`WS close #${myWsId} code=${event.code} manual=${manualClose}`);
      if (!manualClose && event.code !== 1000 && event.code !== 4001 && event.code !== 4003 && event.code !== 4004 && event.code !== 4008
          && status.value !== 'finished' && gameId.value === id) {
        setTimeout(() => connect(id, color), 2000);
      }
    };

    sock.onerror = (err) => {
      if (sock !== ws) return;
      console.error('[Game] WS error', err);
      connecting = false;
    };
  }

  function closeWs(silent) {
    if (!ws) return;
    manualClose = true;
    try {
      ws.onmessage = null;
      ws.onclose = null;
      ws.onerror = null;
      ws.close(1000);
    } catch (_) {}
    ws = null;
    if (!silent) isConnected.value = false;
  }

  function disconnect() {
    pendingMove.value = false;
    closeWs(false);
    connecting = false;
    stopClock();
  }

  function sendMove(from, to, promotion) {
    if (!canMove.value) {
      log('sendMove BLOCKED', { canMove: canMove.value, status: status.value, isConnected: isConnected.value, isMyTurn: isMyTurn.value, pendingMove: pendingMove.value });
      return false;
    }
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      log('sendMove BLOCKED — WS not open');
      return false;
    }

    const uci = from + to + (promotion || '');

    let moveObj;
    try {
      const chess = new Chess(fen.value);
      moveObj = chess.move({ from, to, promotion });
      if (!moveObj) {
        log('sendMove ILLEGAL local', uci, fen.value);
        return false;
      }

      fen.value = chess.fen();
      lastMove.value = { from, to };
      moves.value.push({ uci, san: moveObj.san, fen: chess.fen() });
      isMyTurn.value = false;
      pendingMove.value = true;
    } catch (err) {
      console.error('[Game] sendMove error', err);
      return false;
    }

    playMoveSound({
      capture: moveObj.san?.includes('x'),
      check: moveObj.san?.includes('+') || moveObj.san?.includes('#'),
      castle: moveObj.san === 'O-O' || moveObj.san === 'O-O-O',
    });

    log('sendMove →', uci, 'optimistic ply=' + moves.value.length);
    ws.send(JSON.stringify({
      type: 'move',
      uci,
      timestamp: Date.now(),
    }));
    return true;
  }

  function applyMovePayload(data) {
    pendingMove.value = false;
    if (status.value !== 'finished') status.value = 'active';

    const incomingPly = fenPly(data.fen);
    const local = localPly.value;

    if (incomingPly !== -1 && incomingPly < local) {
      log('move IGNORED stale', { incomingPly, local, uci: data.uci });
      return;
    }

    fen.value = data.fen;
    lastMove.value = { from: data.uci.slice(0, 2), to: data.uci.slice(2, 4) };

    const lastUci = moves.value[moves.value.length - 1]?.uci;
    const alreadyHave = lastUci === data.uci;

    if (!alreadyHave) {
      moves.value.push({ uci: data.uci, san: data.san, fen: data.fen });
      playMoveSound({
        capture: data.san?.includes('x'),
        check: data.san?.includes('+') || data.san?.includes('#'),
        castle: data.san === 'O-O' || data.san === 'O-O-O',
      });
    }

    setClocks(data);
    const turn = recomputeTurnFromFen();
    startOrUpdateClock(turn);

    log('applyMovePayload', { uci: data.uci, ply: moves.value.length, white_clock: whiteClock.value, black_clock: blackClock.value });

    if (data.game_over) {
      handleGameOver(data.game_over);
    }
  }

  function resign() {
    ws?.send(JSON.stringify({ type: 'resign' }));
  }

  function offerDraw() {
    ws?.send(JSON.stringify({ type: 'draw_offer' }));
  }

  function acceptDraw() {
    ws?.send(JSON.stringify({ type: 'draw_accept' }));
  }

  function rejectDraw() {
    drawOffered.value = false;
    ws?.send(JSON.stringify({ type: 'draw_reject' }));
  }

  function handleMessage(data) {
    log('WS ←', data.type, data);
    switch (data.type) {

      case 'move':
      case 'move_made':
        applyMovePayload(data);
        break;

      case 'game_over':
        handleGameOver(data);
        break;

      case 'game_started':
        applySnapshot({ ...data, status: 'active' }, 'game_started');
        break;

      case 'game_sync':
        applySnapshot(data, 'game_sync');
        break;

      case 'player_connected':
        if (data.username !== authStore.user?.username) {
          opponentName.value = data.username;
        }
        break;

      case 'draw_offer':
        drawOffered.value = true;
        break;

      case 'draw_rejected':
        drawOffered.value = false;
        break;

      case 'error':
        console.error('[Game] server error:', data.code);
        if (data.code === 'not_your_turn' || data.code === 'invalid_move_format') {
          // Сервер отверг ход — синхронизируемся с сервером
          requestServerSync();
        }
        break;

      case 'pong':
        break;
    }
  }

  function requestServerSync() {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'sync' }));
    }
  }

  function handleGameOver(data) {
    status.value = 'finished';
    result.value = data.result;
    resultReason.value = data.reason;
    stopClock();
  }

  function startClock(turn) {
    stopClock();
    clockTurn = turn;
    clockRunning.value = true;
    const tickMs = 100;

    clockInterval = setInterval(() => {
      if (!clockRunning.value) return;

      if (turn === 'w') {
        whiteClock.value = Math.max(0, whiteClock.value - tickMs);
        if (whiteClock.value === 0) stopClock();
      } else {
        blackClock.value = Math.max(0, blackClock.value - tickMs);
        if (blackClock.value === 0) stopClock();
      }
    }, tickMs);
  }

  function stopClock() {
    clockRunning.value = false;
    clockTurn = null;
    if (clockInterval) {
      clearInterval(clockInterval);
      clockInterval = null;
    }
  }

  function reset() {
    disconnect();
    gameId.value = null;
    status.value = 'idle';
    result.value = null;
    resultReason.value = null;
    fen.value = START_FEN;
    moves.value = [];
    lastMove.value = null;
    isMyTurn.value = false;
    drawOffered.value = false;
    whiteClock.value = 300_000;
    blackClock.value = 300_000;
    whiteRatingChange.value = null;
    blackRatingChange.value = null;
    opponentName.value = '';
    opponentRating.value = 0;
    pendingMove.value = false;
  }

  // Диагностика — фиксируем переходы canMove
  watch(canMove, (n, o) => {
    log(`canMove ${o} → ${n}`, {
      status: status.value,
      connected: isConnected.value,
      myTurn: isMyTurn.value,
      pending: pendingMove.value,
      over: isGameOver.value,
      ply: moves.value.length,
      fen: fen.value,
    });
  });

  watch(() => fen.value, (n, o) => {
    log(`fen ${o?.slice(0, 30)}… → ${n?.slice(0, 30)}… ply=${moves.value.length}`);
  });

  return {
    gameId, status, result, resultReason,
    fen, moves, lastMove, moveSans, moveUcis, localPly,
    playerColor, myColor, opponentName, opponentRating,
    whiteClock, blackClock, isMyTurn, drawOffered,
    isConnected, isGameOver, isWaitingForOpponent, canMove,
    myRatingChange, whiteRatingChange, blackRatingChange,
    connect, disconnect, sendMove, hydrateFromApi,
    resign, offerDraw, acceptDraw, rejectDraw, reset,
  };
});

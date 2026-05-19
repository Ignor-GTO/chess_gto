/**
 * useGameStore.js — Pinia store для управления игровым состоянием
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { Chess } from 'chess.js';
import axios from '@/plugins/axios';
import { useAuthStore } from './useAuthStore';
import { playMoveSound } from '@/composables/useChessSounds';

export const useGameStore = defineStore('game', () => {
  const authStore = useAuthStore();

  const gameId       = ref(null);
  const status       = ref('idle');
  const result       = ref(null);
  const resultReason = ref(null);

  const fen          = ref('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
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

  let ws = null;
  let pendingMove = false;

  const myColor = computed(() => playerColor.value);
  const isGameOver = computed(() => status.value === 'finished');
  const moveSans = computed(() => moves.value.map(m => m.san));
  const moveUcis = computed(() => moves.value.map(m => m.uci));

  const myRatingChange = computed(() => {
    if (playerColor.value === 'white') return whiteRatingChange.value;
    return blackRatingChange.value;
  });

  function wsBaseUrl() {
    const base = import.meta.env.VITE_WS_URL || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
    return base.replace(/\/$/, '');
  }

  /** Загрузить состояние партии из REST перед WS */
  function hydrateFromApi(data, color) {
    gameId.value = data.id;
    playerColor.value = color;
    status.value = data.status === 'finished' ? 'finished' : data.status;
    fen.value = data.current_fen || fen.value;
    whiteClock.value = Math.round((data.white_time_remaining ?? 300) * 1000);
    blackClock.value = Math.round((data.black_time_remaining ?? 300) * 1000);
    whiteRatingChange.value = data.white_rating_change;
    blackRatingChange.value = data.black_rating_change;
    result.value = data.result;
    resultReason.value = data.result_reason;

    const meId = authStore.user?.id;
    const isWhite = color === 'white';
    const opp = isWhite ? data.black_player : data.white_player;
    if (opp) {
      opponentName.value = opp.username;
      opponentRating.value = Math.round(opp.rating || 0);
    }

    if (data.moves?.length) {
      moves.value = data.moves.map(m => ({ uci: m.uci, san: m.san, fen: m.fen_after }));
      const last = data.moves[data.moves.length - 1];
      lastMove.value = { from: last.uci.slice(0, 2), to: last.uci.slice(2, 4) };
    }

    const turn = fen.value.split(' ')[1];
    isMyTurn.value = (turn === 'w' && color === 'white') || (turn === 'b' && color === 'black');

    if (status.value === 'active' && !isGameOver.value) {
      startClock(turn);
    }
  }

  function connect(id, color) {
    gameId.value = id;
    playerColor.value = color;

    const token = authStore.accessToken;
    const wsUrl = `${wsBaseUrl()}/ws/game/${id}/?token=${token}`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      isConnected.value = true;
    };

    ws.onmessage = (event) => {
      handleMessage(JSON.parse(event.data));
    };

    ws.onclose = (event) => {
      isConnected.value = false;
      if (event.code !== 1000 && status.value === 'active') {
        setTimeout(() => connect(id, color), 3000);
      }
    };

    ws.onerror = (err) => {
      console.error('[WS] Ошибка:', err);
    };
  }

  function disconnect() {
    ws?.close(1000);
    stopClock();
  }

  async function resyncFromServer() {
    if (!gameId.value) return;
    try {
      const { data } = await axios.get(`/api/games/${gameId.value}/`);
      hydrateFromApi(data, playerColor.value);
    } catch (err) {
      console.error('[Game] resync failed:', err);
    }
  }

  function syncClocksAndTurn(data) {
    if (data.white_clock != null) whiteClock.value = data.white_clock;
    if (data.black_clock != null) blackClock.value = data.black_clock;

    const turn = (data.fen || fen.value).split(' ')[1];
    isMyTurn.value = (
      (turn === 'w' && playerColor.value === 'white') ||
      (turn === 'b' && playerColor.value === 'black')
    );

    if (status.value === 'active' && !isGameOver.value) {
      startClock(turn);
    }
  }

  function sendMove(from, to, promotion) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    if (!isMyTurn.value || pendingMove) return false;

    const uci = from + to + (promotion || '');

    try {
      const chess = new Chess(fen.value);
      const moveObj = chess.move({ from, to, promotion });
      if (!moveObj) return false;

      fen.value = chess.fen();
      lastMove.value = { from, to };
      isMyTurn.value = false;
      pendingMove = true;
    } catch {
      return false;
    }

    ws.send(JSON.stringify({
      type: 'move',
      uci,
      timestamp: Date.now(),
    }));
    return true;
  }

  function applyMovePayload(data) {
    pendingMove = false;
    if (status.value !== 'finished') status.value = 'active';

    fen.value = data.fen;
    lastMove.value = { from: data.uci.slice(0, 2), to: data.uci.slice(2, 4) };

    const lastUci = moves.value[moves.value.length - 1]?.uci;
    if (lastUci !== data.uci) {
      moves.value.push({ uci: data.uci, san: data.san, fen: data.fen });
    }

    playMoveSound({
      capture: data.san?.includes('x'),
      check: data.san?.includes('+') || data.san?.includes('#'),
      castle: data.san === 'O-O' || data.san === 'O-O-O',
    });

    syncClocksAndTurn(data);

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
    switch (data.type) {

      case 'move':
      case 'move_made':
        applyMovePayload(data);
        break;

      case 'game_over':
        handleGameOver(data);
        break;

      case 'game_started':
      case 'game_sync':
        status.value = 'active';
        if (data.fen) fen.value = data.fen;
        syncClocksAndTurn(data);
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
        console.error('[Game] Ошибка сервера:', data.code);
        pendingMove = false;
        if (data.code === 'not_your_turn' || data.code === 'invalid_move_format') {
          resyncFromServer();
        }
        break;
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
    fen.value = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
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
  }

  return {
    gameId, status, result, resultReason,
    fen, moves, lastMove, moveSans, moveUcis,
    playerColor, myColor, opponentName, opponentRating,
    whiteClock, blackClock, isMyTurn, drawOffered,
    isConnected, isGameOver, myRatingChange,
    whiteRatingChange, blackRatingChange,
    connect, disconnect, sendMove, hydrateFromApi,
    resign, offerDraw, acceptDraw, rejectDraw, reset,
  };
});

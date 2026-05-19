/**
 * stockfish.worker.js
 *
 * Web Worker для анализа шахматных партий через Stockfish.js (WASM).
 * Запускается в отдельном потоке — не замораживает UI.
 *
 * Протокол UCI (Universal Chess Interface):
 *   - "uci"       → инициализация
 *   - "isready"   → проверка готовности
 *   - "position"  → задать позицию
 *   - "go depth N"→ рассчитать на глубину N
 */

// Stockfish.js v18 — вложенный Worker (importScripts не экспортирует Stockfish)
const STOCKFISH_WORKER_URL = '/stockfish/stockfish.js#,worker';

let stockfish = null;
let resolveEval = null;
let currentDepth = 18;

function initEngine() {
  if (stockfish) {
    stockfish.terminate();
  }
  stockfish = new Worker(STOCKFISH_WORKER_URL);
  stockfish.onmessage = (event) => {
    const line = typeof event.data === 'string' ? event.data : '';
    handleEngineMessage({ data: line });
  };
  stockfish.onerror = () => {
    self.postMessage({ type: 'error', message: 'Stockfish engine failed to load' });
  };
  stockfish.postMessage('uci');
  stockfish.postMessage('setoption name Threads value 2');
  stockfish.postMessage('setoption name Hash value 128');
  stockfish.postMessage('isready');
}

// ─── Обработка ответов движка ───────────────────────────────────────────────

function handleEngineMessage(event) {
  const line = typeof event === 'string' ? event : event.data;

  // Парсим оценку из "info depth ... score cp ..."
  if (line.startsWith('info') && line.includes('score')) {
    const cpMatch = line.match(/score cp (-?\d+)/);
    const mateMatch = line.match(/score mate (-?\d+)/);

    if (cpMatch || mateMatch) {
      const evalResult = {
        type: 'eval',
        cp: cpMatch ? parseInt(cpMatch[1]) : null,
        mate: mateMatch ? parseInt(mateMatch[1]) : null,
        depth: parseInt(line.match(/depth (\d+)/)?.[1] || 0),
        bestMove: line.match(/pv (\S+)/)?.[1] || null,
      };
      // Отправляем промежуточные оценки (для прогресс-бара)
      self.postMessage({ type: 'progress', ...evalResult });
    }
  }

  // Финальный лучший ход
  if (line.startsWith('bestmove')) {
    const bestMove = line.split(' ')[1];
    if (resolveEval) {
      resolveEval(bestMove);
      resolveEval = null;
    }
  }
}

// ─── Получение команд от Vue-компонента ─────────────────────────────────────

self.onmessage = async function (event) {
  const { type, payload } = event.data;

  switch (type) {
    case 'init':
      initEngine();
      attachEvalTracker();
      break;

    case 'analyze_game':
      // payload: { moves: ['e2e4', 'd7d5', ...], depth: 16 }
      await analyzeFullGame(payload.moves, payload.depth || currentDepth);
      break;

    case 'evaluate_position':
      // payload: { fen: '...', depth: 12 }
      const result = await evaluatePosition(payload.fen, payload.depth || 12);
      self.postMessage({ type: 'position_eval', ...result });
      break;
  }
};

// ─── Анализ всей партии ──────────────────────────────────────────────────────

async function analyzeFullGame(moves, depth) {
  self.postMessage({ type: 'analysis_start', total: moves.length });

  const results = [];
  let prevEvalCp = 0; // оценка предыдущего хода (для расчёта изменения)

  for (let i = 0; i < moves.length; i++) {
    // Строим позицию до хода i
    const movesUpTo = moves.slice(0, i + 1).join(' ');
    stockfish.postMessage(`position startpos moves ${movesUpTo}`);
    stockfish.postMessage(`go depth ${depth}`);

    // Ждём результат
    const { cp, mate, bestMove } = await waitForEval();

    // Нормализуем оценку (всегда с точки зрения стороны, которая ходила)
    const isWhiteMove = i % 2 === 0;
    const normalizedCp = isWhiteMove ? cp : -cp;

    // Классифицируем ход
    const cpDiff = Math.abs(normalizedCp - prevEvalCp);
    const classification = classifyMove(cpDiff, normalizedCp, prevEvalCp, bestMove, moves[i]);

    results.push({
      moveIndex: i,
      uci: moves[i],
      evalCp: normalizedCp,
      mateCp: mate,
      cpDiff,
      classification,
      bestMove,
    });

    prevEvalCp = normalizedCp;

    // Прогресс для UI
    self.postMessage({
      type: 'analysis_progress',
      moveIndex: i,
      total: moves.length,
      result: results[results.length - 1],
    });
  }

  // Генерируем текстовый отчёт
  const report = generateReport(results);

  self.postMessage({
    type: 'analysis_complete',
    results,
    report,
  });
}

// ─── Оценка одной позиции ────────────────────────────────────────────────────

function evaluatePosition(fen, depth) {
  return new Promise((resolve) => {
    stockfish.postMessage(`position fen ${fen}`);
    stockfish.postMessage(`go depth ${depth}`);

    const origResolve = resolveEval;
    resolveEval = (bestMove) => {
      // Временно перехватываем последнюю оценку
      resolve({ bestMove, cp: lastCp, mate: lastMate });
      resolveEval = origResolve;
    };
  });
}

let lastCp = 0;
let lastMate = null;

// Переопределяем handler чтобы отслеживать последнюю оценку
const _orig = handleEngineMessage;

// ─── Вспомогательные: ждём bestmove ─────────────────────────────────────────

function waitForEval() {
  return new Promise((resolve) => {
    resolveEval = (bestMove) => {
      resolve({ cp: lastCp, mate: lastMate, bestMove });
    };
  });
}

// Обновляем lastCp при каждом "info score" (после initEngine)
function attachEvalTracker() {
  if (!stockfish) return;
  stockfish.onmessage = (event) => {
    const line = typeof event.data === 'string' ? event.data : '';
    const cpMatch = line.match(/score cp (-?\d+)/);
    const mateMatch = line.match(/score mate (-?\d+)/);
    if (cpMatch) lastCp = parseInt(cpMatch[1]);
    if (mateMatch) lastMate = parseInt(mateMatch[1]);
    handleEngineMessage({ data: line });
  };
}

// ─── Классификация ходов (centipawn разница) ─────────────────────────────────

/**
 * Классификация по изменению оценки (centipawn).
 * Диапазоны взяты из публичного анализа Chess.com.
 *
 * @param {number} cpDiff       - Потеря centipawn (>0 = ухудшение)
 * @param {number} evalAfter    - Оценка после хода
 * @param {number} evalBefore   - Оценка до хода
 * @param {string} bestMove     - Лучший ход по движку
 * @param {string} actualMove   - Реальный ход игрока
 */
function classifyMove(cpDiff, evalAfter, evalBefore, bestMove, actualMove) {
  // Лучший ход
  if (actualMove === bestMove) {
    // Жертва фигуры (оценка упала, но движок считает лучшим) — Brilliant
    if (evalBefore > evalAfter + 100) return 'brilliant';
    return 'best';
  }

  // Книжный ход (в дебютной базе) — TODO: интегрировать ECO базу
  // if (isBookMove(actualMove)) return 'book';

  // Классификация по потере
  if (cpDiff < 10)  return 'excellent';
  if (cpDiff < 25)  return 'good';
  if (cpDiff < 50)  return 'inaccuracy';
  if (cpDiff < 100) return 'mistake';
  return 'blunder';
}

// ─── Генерация текстового отчёта ─────────────────────────────────────────────

/**
 * Формирует структурированный отчёт на русском языке.
 * Пример: "Вы отлично провели дебют (ходы 1-10). Критическая ошибка на ходу 15..."
 */
function generateReport(results) {
  const blunders = results.filter(r => r.classification === 'blunder');
  const mistakes = results.filter(r => r.classification === 'mistake');
  const brilliants = results.filter(r => r.classification === 'brilliant');
  const inaccuracies = results.filter(r => r.classification === 'inaccuracy');

  const totalMoves = results.length;
  const accuracy = calculateAccuracy(results);

  let reportParts = [];

  // Точность
  reportParts.push(`Точность партии: ${accuracy.white}% (белые) / ${accuracy.black}% (чёрные).`);

  // Блестящие ходы
  if (brilliants.length > 0) {
    const moves = brilliants.map(r => `ход ${Math.floor(r.moveIndex / 2) + 1}`).join(', ');
    reportParts.push(`🌟 Блестящие ходы: ${moves}.`);
  }

  // Зевки
  if (blunders.length > 0) {
    const worst = blunders.sort((a, b) => b.cpDiff - a.cpDiff)[0];
    const moveNum = Math.floor(worst.moveIndex / 2) + 1;
    reportParts.push(
      `💥 Критический зевок на ходу ${moveNum} (${worst.uci}): ` +
      `потеря ${Math.round(worst.cpDiff / 100 * 10) / 10} пешки. ` +
      `Лучше было: ${worst.bestMove}.`
    );
  }

  // Ошибки
  if (mistakes.length > 0) {
    reportParts.push(`⚠️ Ошибок: ${mistakes.length}. Неточностей: ${inaccuracies.length}.`);
  }

  // Итог
  if (blunders.length === 0 && mistakes.length <= 1) {
    reportParts.push('✅ В целом отличная партия! Минимальное количество ошибок.');
  } else if (blunders.length > 2) {
    reportParts.push('📚 Рекомендуется поработать над тактикой — много тактических просчётов.');
  }

  return reportParts.join(' ');
}

/**
 * Расчёт точности в стиле Chess.com (на основе потери centipawn).
 */
function calculateAccuracy(results) {
  const whiteResults = results.filter((_, i) => i % 2 === 0);
  const blackResults = results.filter((_, i) => i % 2 === 1);

  const calcAcc = (moves) => {
    if (!moves.length) return 100;
    const avgLoss = moves.reduce((sum, r) => sum + Math.min(r.cpDiff, 200), 0) / moves.length;
    // Формула приближения Chess.com
    return Math.max(0, Math.round(103.1668 * Math.exp(-0.04354 * avgLoss) - 3.1669));
  };

  return {
    white: calcAcc(whiteResults),
    black: calcAcc(blackResults),
  };
}

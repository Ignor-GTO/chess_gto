/**
 * stockfish.worker.js — анализ через Stockfish lite-single (WASM).
 */
const STOCKFISH_URL = '/stockfish/stockfish.js#/stockfish/stockfish.wasm,worker';

let engine = null;
let engineReady = false;
let initPromise = null;
let pendingEval = null;
let lastCp = 0;
let lastMate = null;

function parseEngineLine(line) {
  if (line.startsWith('info') && line.includes('score')) {
    const cpMatch = line.match(/score cp (-?\d+)/);
    const mateMatch = line.match(/score mate (-?\d+)/);
    if (cpMatch) {
      lastCp = parseInt(cpMatch[1], 10);
      lastMate = null;
    } else if (mateMatch) {
      lastMate = parseInt(mateMatch[1], 10);
      lastCp = mateMatch[1] > 0 ? 10000 : -10000;
    }
  }

  if (line.startsWith('bestmove')) {
    const bestMove = line.split(' ')[1];
    if (pendingEval) {
      pendingEval.resolve({
        cp: lastCp,
        mate: lastMate,
        bestMove: bestMove === '(none)' ? null : bestMove,
      });
      pendingEval = null;
    }
  }
}

function initEngine() {
  if (initPromise) return initPromise;

  initPromise = new Promise((resolve, reject) => {
    try {
      engine = new Worker(STOCKFISH_URL);
    } catch (err) {
      reject(err);
      return;
    }

    let gotUciOk = false;

    engine.onerror = () => {
      reject(new Error('Stockfish engine failed to load'));
    };

    engine.onmessage = (event) => {
      const line = typeof event.data === 'string' ? event.data : '';
      if (!line) return;

      if (line === 'uciok') gotUciOk = true;
      if (line === 'readyok' && gotUciOk) {
        engineReady = true;
        resolve();
      }

      parseEngineLine(line);
    };

    engine.postMessage('uci');
    engine.postMessage('setoption name Threads value 1');
    engine.postMessage('setoption name Hash value 32');
    engine.postMessage('isready');

    setTimeout(() => {
      if (!engineReady) reject(new Error('Stockfish init timeout'));
    }, 15000);
  });

  return initPromise;
}

async function ensureReady() {
  if (!engineReady) await initEngine();
}

function analyzePosition(moves, depth) {
  return new Promise((resolve, reject) => {
    lastCp = 0;
    lastMate = null;

    const timer = setTimeout(() => {
      if (pendingEval) {
        pendingEval = null;
        reject(new Error('Analysis timeout'));
      }
    }, 30000);

    pendingEval = {
      resolve: (result) => {
        clearTimeout(timer);
        resolve(result);
      },
    };

    const pos = moves.length
      ? `position startpos moves ${moves.join(' ')}`
      : 'position startpos';

    engine.postMessage(pos);
    engine.postMessage(`go depth ${depth}`);
  });
}

async function analyzeFullGame(moves, depth) {
  await ensureReady();
  self.postMessage({ type: 'analysis_start', total: moves.length });

  const results = [];
  let prevEvalCp = 0;

  for (let i = 0; i < moves.length; i++) {
    const movesUpTo = moves.slice(0, i + 1);
    const { cp, mate, bestMove } = await analyzePosition(movesUpTo, depth);

    const isWhiteMove = i % 2 === 0;
    const normalizedCp = isWhiteMove ? cp : -cp;
    const cpDiff = Math.abs(normalizedCp - prevEvalCp);
    const classification = classifyMove(cpDiff, normalizedCp, prevEvalCp, bestMove, moves[i]);

    const result = {
      moveIndex: i,
      uci: moves[i],
      evalCp: normalizedCp,
      mateCp: mate,
      cpDiff,
      classification,
      bestMove,
    };

    results.push(result);
    prevEvalCp = normalizedCp;

    self.postMessage({
      type: 'analysis_progress',
      moveIndex: i,
      total: moves.length,
      result,
    });
  }

  self.postMessage({
    type: 'analysis_complete',
    results,
    report: generateReport(results),
  });
}

function classifyMove(cpDiff, evalAfter, evalBefore, bestMove, actualMove) {
  if (bestMove && actualMove === bestMove) {
    if (evalBefore > evalAfter + 100) return 'brilliant';
    return 'best';
  }
  if (cpDiff < 10) return 'excellent';
  if (cpDiff < 25) return 'good';
  if (cpDiff < 50) return 'inaccuracy';
  if (cpDiff < 100) return 'mistake';
  return 'blunder';
}

function generateReport(results) {
  const blunders = results.filter(r => r.classification === 'blunder');
  const mistakes = results.filter(r => r.classification === 'mistake');
  const brilliants = results.filter(r => r.classification === 'brilliant');
  const accuracy = calculateAccuracy(results);

  const parts = [
    `Точность: ${accuracy.white}% (белые) / ${accuracy.black}% (чёрные).`,
  ];

  if (brilliants.length) {
    parts.push(`Блестящие ходы: ${brilliants.map(r => Math.floor(r.moveIndex / 2) + 1).join(', ')}.`);
  }
  if (blunders.length) {
    const worst = blunders.sort((a, b) => b.cpDiff - a.cpDiff)[0];
    parts.push(
      `Критический зевок на ходу ${Math.floor(worst.moveIndex / 2) + 1}: ` +
      `лучше было ${worst.bestMove || '—'}.`,
    );
  }
  if (mistakes.length) {
    parts.push(`Ошибок: ${mistakes.length}, неточностей: ${results.filter(r => r.classification === 'inaccuracy').length}.`);
  }
  if (!blunders.length && mistakes.length <= 1) {
    parts.push('Хорошая партия — мало серьёзных ошибок.');
  }

  return parts.join(' ');
}

function calculateAccuracy(results) {
  const calcAcc = (moves) => {
    if (!moves.length) return 100;
    const avgLoss = moves.reduce((sum, r) => sum + Math.min(r.cpDiff || 0, 200), 0) / moves.length;
    return Math.max(0, Math.round(103.1668 * Math.exp(-0.04354 * avgLoss) - 3.1669));
  };
  return {
    white: calcAcc(results.filter((_, i) => i % 2 === 0)),
    black: calcAcc(results.filter((_, i) => i % 2 === 1)),
  };
}

self.onmessage = async (event) => {
  const { type, payload } = event.data;

  try {
    switch (type) {
      case 'init':
        await initEngine();
        self.postMessage({ type: 'ready' });
        break;

      case 'analyze_game':
        await analyzeFullGame(payload.moves, payload.depth || 12);
        break;

      default:
        break;
    }
  } catch (err) {
    self.postMessage({ type: 'error', message: String(err.message || err) });
  }
};

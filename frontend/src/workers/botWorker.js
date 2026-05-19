/**
 * botWorker.js — Web Worker для ходов бота (Stockfish).
 *
 * Отдельный воркер от аналитического — чтобы не мешать анализу.
 * Принимает позицию → возвращает лучший ход с заданным уровнем.
 */
importScripts('/stockfish/stockfish.js');

const STOCKFISH_OPTS = {
  locateFile: (file) =>
    file.includes('.wasm') ? '/stockfish/stockfish.wasm' : file,
};

let engine = null;
let resolveMove = null;
let currentSkillLevel = 10;

function init(skillLevel = 10) {
  currentSkillLevel = skillLevel;
  engine = Stockfish(STOCKFISH_OPTS);
  engine.onmessage = handleMessage;
  engine.postMessage('uci');
  engine.postMessage(`setoption name Skill Level value ${skillLevel}`);
  // Ограничиваем глубину для слабых уровней
  if (skillLevel < 5) {
    engine.postMessage('setoption name UCI_LimitStrength value true');
    engine.postMessage(`setoption name UCI_Elo value ${600 + skillLevel * 100}`);
  }
  engine.postMessage('setoption name Threads value 1');
  engine.postMessage('setoption name Hash value 32');
  engine.postMessage('isready');
}

function handleMessage(event) {
  const line = typeof event === 'string' ? event : event.data;
  if (line.startsWith('bestmove')) {
    const move = line.split(' ')[1];
    if (resolveMove && move && move !== '(none)') {
      resolveMove(move);
      resolveMove = null;
    }
  }
}

self.onmessage = function(event) {
  const { type, payload } = event.data;

  switch (type) {
    case 'init':
      init(payload.skillLevel ?? 10);
      break;

    case 'get_move':
      // payload: { moves: ['e2e4', ...], movetime: 500 }
      if (!engine) init(currentSkillLevel);
      const movesStr = payload.moves.length
        ? `position startpos moves ${payload.moves.join(' ')}`
        : 'position startpos';

      engine.postMessage(movesStr);
      // movetime в мс — время на обдумывание
      engine.postMessage(`go movetime ${payload.movetime || 500}`);

      new Promise((resolve) => { resolveMove = resolve; })
        .then(move => {
          self.postMessage({ type: 'bot_move', uci: move });
        });
      break;

    case 'set_skill':
      currentSkillLevel = payload.skillLevel;
      engine?.postMessage(`setoption name Skill Level value ${payload.skillLevel}`);
      break;

    case 'stop':
      engine?.postMessage('stop');
      break;
  }
};

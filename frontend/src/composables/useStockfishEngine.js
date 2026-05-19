/**
 * Stockfish — прямой Worker (без вложенности).
 * ВАЖНО: hash с суффиксом ",worker" ломает WASM — не использовать.
 */
const STOCKFISH_URLS = [
  '/stockfish/stockfish.js#/stockfish/stockfish.wasm',
  '/stockfish/stockfish.js',
  '/stockfish/stockfish-asm.js',
];

const URL_TIMEOUT_MS = 12000;

function splitLines(data) {
  if (data == null) return [];
  const text = typeof data === 'string' ? data : String(data);
  if (!text) return [];
  return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

function firstWord(line) {
  const i = line.indexOf(' ');
  return i === -1 ? line : line.slice(0, i);
}

function cmdType(line) {
  const w = firstWord(line);
  if (w === 'uciok' || w === 'option' || w === 'id') return 'uci';
  if (w === 'readyok') return 'isready';
  if (w === 'bestmove' || w === 'info') return 'go';
  return 'other';
}

export function useStockfishEngine() {
  let worker = null;
  let ready = false;
  let initPromise = null;
  const queue = [];
  const passiveListeners = [];

  function notifyLine(line) {
    for (const fn of passiveListeners) fn(line);
  }

  function dispatchLine(line) {
    notifyLine(line);
    if (!queue.length) return;

    const type = cmdType(line);
    let idx = queue.findIndex((q) => firstWord(q.cmd) === type);
    if (idx === -1) idx = 0;

    const item = queue[idx];
    if (!item) return;

    if (typeof item.message === 'undefined') item.message = '';
    else if (item.message) item.message += '\n';
    item.message += line;

    if (item.stream) item.stream(line);

    let done = false;
    if (line === 'uciok' && firstWord(item.cmd) === 'uci') done = true;
    else if (line === 'readyok' && firstWord(item.cmd) === 'isready') done = true;
    else if (line.startsWith('bestmove') && firstWord(item.cmd) === 'go') done = true;

    if (done) {
      queue.splice(idx, 1);
      item.resolve(item.message);
    }
  }

  function onMessage(event) {
    for (const line of splitLines(event.data)) {
      dispatchLine(line);
    }
  }

  function waitForLine(test, timeoutMs = URL_TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const i = passiveListeners.indexOf(handler);
        if (i !== -1) passiveListeners.splice(i, 1);
        reject(new Error('Stockfish init timeout'));
      }, timeoutMs);

      const handler = (line) => {
        if (test(line)) {
          clearTimeout(timer);
          const i = passiveListeners.indexOf(handler);
          if (i !== -1) passiveListeners.splice(i, 1);
          resolve(line);
        }
      };

      passiveListeners.push(handler);
    });
  }

  function send(cmd) {
    return new Promise((resolve, reject) => {
      if (!worker) {
        reject(new Error('Stockfish not loaded'));
        return;
      }

      const trimmed = String(cmd).trim();
      const noReply =
        trimmed === 'ucinewgame' ||
        trimmed.startsWith('position') ||
        trimmed.startsWith('setoption') ||
        trimmed === 'stop';

      if (!noReply) {
        queue.push({ cmd: trimmed, resolve, reject });
      }

      worker.postMessage(trimmed);

      if (noReply) {
        resolve('');
      }
    });
  }

  function destroy() {
    queue.splice(0, queue.length);
    passiveListeners.splice(0, passiveListeners.length);
    if (worker) {
      try {
        worker.terminate();
      } catch (_) {
        /* ignore */
      }
    }
    worker = null;
    ready = false;
    initPromise = null;
  }

  async function connect(url) {
    destroy();

    await new Promise((resolve, reject) => {
      try {
        worker = new Worker(url);
      } catch (err) {
        reject(err);
        return;
      }

      const fail = (err) => {
        destroy();
        reject(err instanceof Error ? err : new Error(String(err)));
      };

      worker.onerror = () => fail(new Error('Stockfish engine failed to load'));
      worker.onmessage = onMessage;

      const uciWait = waitForLine((line) => line === 'uciok');
      worker.postMessage('uci');

      uciWait
        .then(async () => {
          await send('setoption name Threads value 1');
          await send('setoption name Hash value 16');
          const readyWait = waitForLine((line) => line === 'readyok');
          worker.postMessage('isready');
          await readyWait;
          ready = true;
          resolve();
        })
        .catch(fail);
    });
  }

  async function init() {
    if (ready) return;
    if (initPromise) return initPromise;

    initPromise = (async () => {
      let lastErr = null;
      for (const url of STOCKFISH_URLS) {
        try {
          await Promise.race([
            connect(url),
            new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Stockfish init timeout')), URL_TIMEOUT_MS);
            }),
          ]);
          return;
        } catch (err) {
          lastErr = err;
          destroy();
        }
      }
      initPromise = null;
      throw lastErr || new Error('Stockfish init timeout');
    })();

    return initPromise;
  }

  async function analyzePosition(moves, depth = 12) {
    await init();

    let lastCp = 0;
    let lastMate = null;
    let bestMove = null;

    const pos = moves.length
      ? `position startpos moves ${moves.join(' ')}`
      : 'position startpos';

    await send(pos);
    const msg = await send(`go depth ${depth}`);

    for (const line of splitLines(msg)) {
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
        const bm = line.split(' ')[1];
        bestMove = bm === '(none)' ? null : bm;
      }
    }

    return { cp: lastCp, mate: lastMate, bestMove };
  }

  return { init, analyzePosition, destroy, ready: () => ready };
}

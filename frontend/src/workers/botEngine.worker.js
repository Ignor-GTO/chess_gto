/**
 * Web Worker — расчёт хода бота off the main thread.
 */
import { pickBotMove } from '../utils/botEngine.js';

self.onmessage = ({ data }) => {
  try {
    const move = pickBotMove(data.fen, data.skillLevel ?? 10);
    self.postMessage({ requestId: data.requestId, ok: true, move });
  } catch (err) {
    self.postMessage({ requestId: data.requestId, ok: false, error: String(err) });
  }
};

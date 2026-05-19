/**
 * Локальный бот на chess.js — без Web Workers и Stockfish.
 */
import { Chess } from 'chess.js';

const PIECE_VALUES = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

function evaluateMaterial(chess) {
  let score = 0;
  for (const row of chess.board()) {
    for (const cell of row) {
      if (!cell) continue;
      const val = PIECE_VALUES[cell.type] || 0;
      score += cell.color === 'w' ? val : -val;
    }
  }
  return score;
}

function evaluate(chess, forWhite) {
  const material = evaluateMaterial(chess);
  const score = forWhite ? material : -material;
  if (chess.isCheckmate()) return forWhite ? -99999 : 99999;
  if (chess.isDraw()) return 0;
  return score;
}

function searchBest(chess, depth, forWhite, skillLevel) {
  if (depth === 0 || chess.isGameOver()) {
    return { score: evaluate(chess, forWhite) };
  }

  const moves = chess.moves({ verbose: true });
  if (!moves.length) return { score: evaluate(chess, forWhite) };

  let bestScore = forWhite ? -Infinity : Infinity;
  let bestMoves = [];

  for (const move of moves) {
    chess.move(move);
    const { score } = searchBest(chess, depth - 1, forWhite, skillLevel);
    chess.undo();

    const isBetter = forWhite ? score > bestScore : score < bestScore;
    const isEqual = score === bestScore;

    if (isBetter || isEqual) {
      if (isBetter) {
        bestScore = score;
        bestMoves = [move];
      } else {
        bestMoves.push(move);
      }
    }
  }

  const slip = skillLevel < 5 ? 0.45 : skillLevel < 10 ? 0.2 : skillLevel < 15 ? 0.08 : 0;
  if (slip > 0 && Math.random() < slip && moves.length > 1) {
    return { move: moves[Math.floor(Math.random() * moves.length)], score: bestScore };
  }

  const pick = bestMoves[Math.floor(Math.random() * bestMoves.length)] || moves[0];
  return { move: pick, score: bestScore };
}

/**
 * @param {string} fen
 * @param {number} skillLevel 0–20
 */
export function pickBotMove(fen, skillLevel = 10) {
  const chess = new Chess(fen);
  const legal = chess.moves({ verbose: true });
  if (!legal.length) return null;

  const botIsWhite = chess.turn() === 'w';
  const depth = skillLevel >= 15 ? 2 : skillLevel >= 5 ? 1 : 0;

  if (depth === 0) {
    const m = legal[Math.floor(Math.random() * legal.length)];
    return { from: m.from, to: m.to, promotion: m.promotion };
  }

  const { move } = searchBest(chess, depth, botIsWhite, skillLevel);
  if (!move) {
    const m = legal[0];
    return { from: m.from, to: m.to, promotion: m.promotion };
  }

  return { from: move.from, to: move.to, promotion: move.promotion };
}

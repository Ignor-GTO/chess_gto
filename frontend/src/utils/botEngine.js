/**
 * Локальный бот — лёгкий minimax (глубина 0–1), без зависаний UI.
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

function evaluate(chess, maximizingWhite) {
  const material = evaluateMaterial(chess);
  const score = maximizingWhite ? material : -material;
  if (chess.isCheckmate()) return maximizingWhite ? -99999 : 99999;
  if (chess.isDraw()) return 0;
  return score;
}

function pickBestMove(chess, maximizingWhite, skillLevel) {
  const moves = chess.moves({ verbose: true });
  if (!moves.length) return null;

  let bestScore = maximizingWhite ? -Infinity : Infinity;
  let best = [];

  for (const move of moves) {
    chess.move(move);
    const score = evaluate(chess, maximizingWhite);
    chess.undo();

    const better = maximizingWhite ? score > bestScore : score < bestScore;
    if (better) {
      bestScore = score;
      best = [move];
    } else if (score === bestScore) {
      best.push(move);
    }
  }

  const slip = skillLevel < 5 ? 0.5 : skillLevel < 10 ? 0.25 : skillLevel < 15 ? 0.1 : 0;
  if (slip > 0 && Math.random() < slip) {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  return best[Math.floor(Math.random() * best.length)] || moves[0];
}

export function pickBotMove(fen, skillLevel = 10) {
  const chess = new Chess(fen);
  const legal = chess.moves({ verbose: true });
  if (!legal.length) return null;

  const botIsWhite = chess.turn() === 'w';
  const useSearch = skillLevel >= 5;

  if (!useSearch) {
    const m = legal[Math.floor(Math.random() * legal.length)];
    return { from: m.from, to: m.to, promotion: m.promotion };
  }

  const move = pickBestMove(chess, botIsWhite, skillLevel);
  if (!move) return null;

  return { from: move.from, to: move.to, promotion: move.promotion };
}

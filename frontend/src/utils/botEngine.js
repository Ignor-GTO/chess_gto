/**
 * Локальный бот — minimax с PST, глубина по уровню (в Worker).
 */
import { Chess } from 'chess.js';

const PIECE_VALUES = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

const PST = {
  p: [
     0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
     5,  5, 10, 25, 25, 10,  5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5, -5,-10,  0,  0,-10, -5,  5,
     5, 10, 10,-20,-20, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0,
  ],
  n: [
    -50,-40,-30,-30,-30,-30,-40,-50,
    -40,-20,  0,  0,  0,  0,-20,-40,
    -30,  0, 10, 15, 15, 10,  0,-30,
    -30,  5, 15, 20, 20, 15,  5,-30,
    -30,  0, 15, 20, 20, 15,  0,-30,
    -30,  5, 10, 15, 15, 10,  5,-30,
    -40,-20,  0,  5,  5,  0,-20,-40,
    -50,-40,-30,-30,-30,-30,-40,-50,
  ],
  b: [
    -20,-10,-10,-10,-10,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10,  5,  5, 10, 10,  5,  5,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10, 10, 10, 10, 10, 10, 10,-10,
    -10,  5,  0,  0,  0,  0,  5,-10,
    -20,-10,-10,-10,-10,-10,-10,-20,
  ],
  r: [
     0,  0,  0,  0,  0,  0,  0,  0,
     5, 10, 10, 10, 10, 10, 10,  5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
     0,  0,  0,  5,  5,  0,  0,  0,
  ],
  q: [
    -20,-10,-10, -5, -5,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5,  5,  5,  5,  0,-10,
     -5,  0,  5,  5,  5,  5,  0, -5,
      0,  0,  5,  5,  5,  5,  0, -5,
    -10,  5,  5,  5,  5,  5,  0,-10,
    -10,  0,  5,  0,  0,  0,  0,-10,
    -20,-10,-10, -5, -5,-10,-10,-20,
  ],
  k: [
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -20,-30,-30,-40,-40,-30,-30,-20,
    -10,-20,-20,-20,-20,-20,-20,-10,
     20, 20,  0,  0,  0,  0, 20, 20,
     20, 30, 10,  0,  0, 10, 30, 20,
  ],
};

function sqIndex(square) {
  const file = square.charCodeAt(0) - 97;
  const rank = parseInt(square[1], 10) - 1;
  return rank * 8 + file;
}

function pstValue(piece, square) {
  const table = PST[piece.type];
  if (!table) return 0;
  const idx = piece.color === 'w' ? sqIndex(square) : 63 - sqIndex(square);
  return table[idx] || 0;
}

function evaluate(chess) {
  let score = 0;
  for (const row of chess.board()) {
    for (const cell of row) {
      if (!cell) continue;
      const val = (PIECE_VALUES[cell.type] || 0) + pstValue(cell, cell.square);
      score += cell.color === 'w' ? val : -val;
    }
  }

  if (chess.isCheck()) {
    score += chess.turn() === 'w' ? -25 : 25;
  }
  if (chess.isCheckmate()) {
    return chess.turn() === 'w' ? -99999 : 99999;
  }
  if (chess.isDraw()) return 0;

  return score;
}

function orderMoves(moves) {
  return [...moves].sort((a, b) => {
    const score = (m) =>
      (m.captured ? 1000 : 0) +
      (m.san.includes('+') ? 50 : 0) +
      (m.promotion ? 30 : 0);
    return score(b) - score(a);
  });
}

function searchDepth(skillLevel) {
  if (skillLevel <= 0) return 0;
  if (skillLevel <= 5) return 1;
  if (skillLevel <= 10) return 2;
  if (skillLevel <= 15) return 3;
  return 4;
}

function slipChance(skillLevel) {
  if (skillLevel <= 0) return 1;
  if (skillLevel <= 5) return 0.35;
  if (skillLevel <= 10) return 0.18;
  if (skillLevel <= 15) return 0.06;
  return 0.02;
}

function negamax(chess, depth, alpha, beta) {
  if (depth === 0 || chess.isGameOver()) {
    const ev = evaluate(chess);
    return chess.turn() === 'w' ? ev : -ev;
  }

  const moves = orderMoves(chess.moves({ verbose: true }));
  if (!moves.length) {
    const ev = evaluate(chess);
    return chess.turn() === 'w' ? ev : -ev;
  }

  let best = -Infinity;
  for (const move of moves) {
    chess.move(move);
    const score = -negamax(chess, depth - 1, -beta, -alpha);
    chess.undo();
    best = Math.max(best, score);
    alpha = Math.max(alpha, best);
    if (alpha >= beta) break;
  }
  return best;
}

function pickBestMove(chess, skillLevel) {
  const depth = searchDepth(skillLevel);
  const moves = orderMoves(chess.moves({ verbose: true }));
  if (!moves.length) return null;

  const scored = moves.map((move) => {
    chess.move(move);
    const score = -negamax(chess, depth - 1, -Infinity, Infinity);
    chess.undo();
    return { move, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const slip = slipChance(skillLevel);
  if (Math.random() < slip) {
    const topN = skillLevel <= 5 ? 4 : skillLevel <= 10 ? 3 : 2;
    const pool = scored.slice(0, Math.min(topN, scored.length));
    return pool[Math.floor(Math.random() * pool.length)].move;
  }

  const bestScore = scored[0].score;
  const best = scored.filter(s => s.score === bestScore).map(s => s.move);
  return best[Math.floor(Math.random() * best.length)];
}

export function pickBotMove(fen, skillLevel = 10) {
  const chess = new Chess(fen);
  const legal = chess.moves({ verbose: true });
  if (!legal.length) return null;

  if (skillLevel <= 0) {
    const m = legal[Math.floor(Math.random() * legal.length)];
    return { from: m.from, to: m.to, promotion: m.promotion };
  }

  const move = pickBestMove(chess, skillLevel);
  if (!move) return null;

  return { from: move.from, to: move.to, promotion: move.promotion };
}

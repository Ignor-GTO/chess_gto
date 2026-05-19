/**
 * Классификация ходов и fallback-анализ через локальный движок.
 */
import { Chess } from 'chess.js';
import { pickBotMove } from './botEngine.js';

export function classifyMove(cpDiff, evalAfter, evalBefore, bestMove, actualMove) {
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

export function calculateAccuracy(results) {
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

export function buildCoachText(result, san, { playerColor = 'white' } = {}) {
  if (!result) return '';
  const moveNum = Math.floor(result.moveIndex / 2) + 1;
  const isWhite = result.moveIndex % 2 === 0;
  const isPlayer = (isWhite && playerColor === 'white') || (!isWhite && playerColor === 'black');
  const who = isPlayer ? 'Вы' : 'Соперник';
  const moveLabel = san || result.uci || '';

  switch (result.classification) {
    case 'blunder':
      return `${who} зевнули на ${moveNum}-м ходу: ${moveLabel}. Лучше было ${result.bestMove || 'другое продолжение'}.`;
    case 'mistake':
      return `${moveNum}-й ход ${moveLabel} — ошибка. Сильнее ${result.bestMove || 'было другое'}.`;
    case 'inaccuracy':
      return `${moveNum}-й ход ${moveLabel} — неточность.`;
    case 'brilliant':
      return `Блестящий ход! ${moveNum}. ${moveLabel}.`;
    case 'best':
      return `${moveNum}. ${moveLabel} — лучший ход в позиции.`;
    case 'excellent':
      return `${moveNum}. ${moveLabel} — отличное продолжение.`;
    case 'good':
      return `${moveNum}. ${moveLabel} — хороший ход.`;
    default:
      return `${moveNum}. ${moveLabel}.`;
  }
}

export function buildReviewSteps(results, moveSans, playerColor) {
  const steps = [{
    fenIdx: 0,
    kind: 'intro',
    text: 'Просмотрим вашу партию с самого начала.',
  }];

  results.forEach((r, i) => {
    steps.push({
      fenIdx: i + 1,
      kind: 'move',
      moveIndex: i,
      classification: r.classification,
      text: buildCoachText(r, moveSans[i], { playerColor }),
    });
  });

  return steps;
}

export async function analyzeGameWithBot(moves, onProgress) {
  const chess = new Chess();
  const results = [];
  let prevEvalCp = 0;

  for (let i = 0; i < moves.length; i++) {
    const fenBefore = chess.fen();
    const best = pickBotMove(fenBefore, 20);
    const bestUci = best ? best.from + best.to + (best.promotion || '') : null;

    const uci = moves[i];
    const move = chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci[4] || undefined,
    });

    if (!move) continue;

    const evalAfter = move.color === 'w' ? 20 : -20;
    const normalizedCp = move.color === 'w' ? evalAfter : -evalAfter;
    const cpDiff = Math.abs(normalizedCp - prevEvalCp);
    const classification = classifyMove(
      cpDiff,
      normalizedCp,
      prevEvalCp,
      bestUci,
      uci,
    );

    const result = {
      moveIndex: i,
      uci,
      evalCp: normalizedCp,
      mateCp: null,
      cpDiff,
      classification,
      bestMove: bestUci,
    };

    results.push(result);
    prevEvalCp = normalizedCp;

    if (onProgress) {
      onProgress(i, moves.length, result);
    }
  }

  return results;
}

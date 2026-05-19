/**
 * Копирует Stockfish lite-single (WASM ~7MB) в public/stockfish.
 * Рекомендуемая сборка из stockfish.js — быстрая и надёжная в браузере.
 */
import { cpSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(root, '..');
const dest = join(projectRoot, 'public', 'stockfish');
const bin = join(projectRoot, 'node_modules', 'stockfish', 'bin');

const JS_NAME = 'stockfish-18-lite-single.js';
const WASM_NAME = 'stockfish-18-lite-single.wasm';

mkdirSync(dest, { recursive: true });

const jsSrc = join(bin, JS_NAME);
const wasmSrc = join(bin, WASM_NAME);

if (!existsSync(jsSrc) || !existsSync(wasmSrc)) {
  console.error('[copy-stockfish] Missing files in', bin);
  process.exit(1);
}

cpSync(jsSrc, join(dest, 'stockfish.js'));
cpSync(wasmSrc, join(dest, 'stockfish.wasm'));
console.log('[copy-stockfish] copied lite-single → public/stockfish/');

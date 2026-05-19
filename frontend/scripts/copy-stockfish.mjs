/**
 * Копирует Stockfish ASM (без WASM) в public/stockfish.
 * ASM надёжнее на проде: не нужен отдельный .wasm файл.
 */
import { cpSync, mkdirSync, existsSync, rmSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(root, '..');
const dest = join(projectRoot, 'public', 'stockfish');
const bin = join(projectRoot, 'node_modules', 'stockfish', 'bin');

const JS_NAME = 'stockfish-18-asm.js';

mkdirSync(dest, { recursive: true });

const jsSrc = join(bin, JS_NAME);
if (!existsSync(jsSrc)) {
  console.error('[copy-stockfish] Missing', jsSrc);
  process.exit(1);
}

cpSync(jsSrc, join(dest, 'stockfish.js'));
console.log('[copy-stockfish] copied', JS_NAME, '→ public/stockfish/stockfish.js');

const wasmDest = join(dest, 'stockfish.wasm');
if (existsSync(wasmDest)) {
  rmSync(wasmDest);
  console.log('[copy-stockfish] removed legacy stockfish.wasm');
}

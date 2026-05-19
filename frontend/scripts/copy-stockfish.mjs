/**
 * Копирует Stockfish lite-single (JS + WASM) в public/stockfish.
 */
import { cpSync, mkdirSync, existsSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const root = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(root, '..');
const dest = join(projectRoot, 'public', 'stockfish');
const bin = join(projectRoot, 'node_modules', 'stockfish', 'bin');

const JS_NAME = 'stockfish-18-lite-single.js';
const WASM_NAME = 'stockfish-18-lite-single.wasm';
const WASM_URL =
  'https://github.com/nmrugg/stockfish.js/releases/download/v18.0.0/stockfish-18-lite-single.wasm';

mkdirSync(dest, { recursive: true });

const jsSrc = join(bin, JS_NAME);
if (!existsSync(jsSrc)) {
  console.error('[copy-stockfish] Missing', jsSrc);
  process.exit(1);
}
cpSync(jsSrc, join(dest, 'stockfish.js'));
console.log('[copy-stockfish] copied', JS_NAME, '→ public/stockfish/stockfish.js');

const wasmDest = join(dest, 'stockfish.wasm');
const wasmLocal = join(bin, WASM_NAME);

if (existsSync(wasmLocal)) {
  cpSync(wasmLocal, wasmDest);
  console.log('[copy-stockfish] copied local wasm');
} else if (!existsSync(wasmDest)) {
  console.log('[copy-stockfish] downloading wasm…');
  await new Promise((resolve, reject) => {
    https.get(WASM_URL, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${WASM_URL}`));
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        writeFileSync(wasmDest, Buffer.concat(chunks));
        console.log('[copy-stockfish] downloaded stockfish.wasm');
        resolve();
      });
    }).on('error', reject);
  });
}

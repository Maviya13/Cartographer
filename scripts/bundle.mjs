import { build } from 'esbuild';
import { existsSync, mkdirSync, rmSync } from 'fs';
import path from 'path';

const root = process.cwd();
const outDir = path.join(root, 'out');

if (existsSync(outDir)) {
  rmSync(outDir, { recursive: true, force: true });
}
mkdirSync(outDir, { recursive: true });

await build({
  entryPoints: [path.join(root, 'src', 'extension.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  outfile: path.join(outDir, 'extension.js'),
  external: ['vscode'],
  sourcemap: false,
  logLevel: 'info'
});

console.log('bundle complete: out/extension.js');

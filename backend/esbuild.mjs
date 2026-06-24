import path from 'node:path';
import { build } from 'esbuild';

// Inline @rap/engine by aliasing the bare specifier to the built file: an
// absolute path bypasses `packages: 'external'`, so esbuild bundles it (and
// resolves the engine's extensionless internal imports at bundle time).
const enginePath = path.resolve(import.meta.dirname, '../engine/dist/index.js');

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  outfile: 'dist/server.js',
  sourcemap: true,
  packages: 'external',
  alias: { '@rap/engine': enginePath },
  banner: {
    js: "import { createRequire } from 'node:module'; const require=createRequire(import.meta.url);",
  },
});

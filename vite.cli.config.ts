import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import copy from 'rollup-plugin-copy';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXTERNALS = [
  'assert', 'async_hooks', 'buffer', 'child_process', 'cluster', 'console',
  'constants', 'crypto', 'dgram', 'dns', 'domain', 'events', 'fs', 'http',
  'http2', 'https', 'inspector', 'module', 'net', 'os', 'path', 'perf_hooks',
  'process', 'punycode', 'querystring', 'readline', 'repl', 'stream',
  'string_decoder', 'timers', 'tls', 'trace_events', 'tty', 'url', 'util',
  'v8', 'vm', 'zlib', 'worker_threads', 'ws', 'fsevents', 'chromium-bidi', 'glob',
  'vite', 'rollup', 'typescript', 'module-alias', 'playwright', 'playwright-core', 
  'fdir', 'picomatch'
];

export default defineConfig({
  plugins: [
    copy({
      targets: [
        { src: 'node_modules/jasmine-core/**/*', dest: 'dist/ts-test-runner/vendor' },
        { src: 'node_modules/vite/**/*', dest: 'dist/ts-test-runner/vendor' },
        { src: 'node_modules/fdir/**/*', dest: 'dist/ts-test-runner/vendor' },
        { src: 'node_modules/picomatch/**/*', dest: 'dist/ts-test-runner/vendor' },
        { src: 'node_modules/playwright-core/**/*', dest: 'dist/ts-test-runner/vendor' },
        { src: 'node_modules/playwright/**/*', dest: 'dist/ts-test-runner/vendor' },
        { src: 'node_modules/module-alias/**/*', dest: 'dist/ts-test-runner/vendor' }
      ],
      hook: 'writeBundle',
      flatten: false
    })
  ],
  build: {
    target: 'node22',
    outDir: 'dist/ts-test-runner/',
    emptyOutDir: false,
    lib: {
      entry: path.resolve('index.ts'),
      formats: ['es'],
      fileName: () => 'lib/index.js'
    },
    minify: false,
    chunkSizeWarningLimit: 5000,
    rollupOptions: {
      input: path.resolve(__dirname, './src/index.ts'),
      output: {
        entryFileNames: 'bin/ts-test-runner',
        format: 'es',
        banner: `#!/usr/bin/env node
// Setup module aliases before anything else
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const ___fileURLToPath = require('url').fileURLToPath;
const ___path = require('path');

const ___moduleAlias = require('../vendor/module-alias');

const __dirname = ___path.dirname(___fileURLToPath(import.meta.url));
const ___norm = (p) => p.replace(/\\\\/g, '/');
// Register aliases
___moduleAlias.addAlias('jasmine-core', ___norm(___path.join(__dirname, '../vendor/jasmine-core')));
___moduleAlias.addAlias('fdir', ___norm(___path.join(__dirname, '../vendor/fdir')));
___moduleAlias.addAlias('picomatch', ___norm(___path.join(__dirname, '../vendor/picomatch')));
___moduleAlias.addAlias('vite', ___norm(___path.join(__dirname, '../vendor/vite')));
___moduleAlias.addAlias('playwright-core', ___norm(___path.join(__dirname, '../vendor/playwright-core')));
___moduleAlias.addAlias('playwright', ___norm(___path.join(__dirname, '../vendor/playwright')));
`,
        inlineDynamicImports: true,
        manualChunks: undefined
      },
      external: (id) => {
        if (id.startsWith('node:')) return true;
        if (EXTERNALS.includes(id)) return true;
        return false;
      }
    }
  }
});

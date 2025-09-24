const path = require('path');
const { defineConfig } = require('vite');
const copy = require('rollup-plugin-copy');

const EXTERNALS = [
  'assert', 'async_hooks', 'buffer', 'child_process', 'cluster', 'console',
  'constants', 'crypto', 'dgram', 'dns', 'domain', 'events', 'fs', 'http',
  'http2', 'https', 'inspector', 'module', 'net', 'os', 'path', 'perf_hooks',
  'process', 'punycode', 'querystring', 'readline', 'repl', 'stream',
  'string_decoder', 'timers', 'tls', 'trace_events', 'tty', 'url', 'util',
  'v8', 'vm', 'zlib', 'worker_threads', 'ws', 'fsevents', 'chromium-bidi', 'glob',
  'vite', 'rollup', 'typescript', 'module-alias', 'playwright', 'playwright-core'
];

module.exports = defineConfig({
  plugins: [
    copy({
      targets: [
        { 
          src: 'node_modules/jasmine-core/**/*', 
          dest: 'dist/ts-test-runner/vendor' 
        }
      ],
      hook: 'writeBundle',
      flatten: false
    })
  ],
  build: {
    target: 'node22',
    outDir: 'dist/ts-test-runner/',
    emptyOutDir: false,
    lib: false,
    minify: false,
    chunkSizeWarningLimit: 5000,
    rollupOptions: {
      input: path.resolve(__dirname, './index.ts'),
      output: {
        entryFileNames: 'bin/ts-test-runner',
        format: 'es',
        banner: `#!/usr/bin/env node`,
        inlineDynamicImports: true,
        manualChunks: undefined
      },
      external: (id: string) => {
        if (id.startsWith('node:')) return true;
        if (EXTERNALS.includes(id)) return true;
        return false;
      }
    }
  }
});
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXTERNALS = [
  'assert', 'async_hooks', 'buffer', 'child_process', 'cluster', 'console',
  'constants', 'crypto', 'dgram', 'dns', 'domain', 'events', 'fs', 'http',
  'http2', 'https', 'inspector', 'module', 'net', 'os', 'path', 'perf_hooks',
  'process', 'punycode', 'querystring', 'readline', 'repl', 'stream',
  'string_decoder', 'timers', 'tls', 'trace_events', 'tty', 'url', 'util',
  'v8', 'vm', 'zlib', 'worker_threads', 'ws', 'fsevents', 'chromium-bidi', 'glob',
  'vite', 'rollup', 'typescript', 'module-alias', 'playwright', 'playwright-core'
];

export default defineConfig({
  build: {
    target: 'node22',
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: path.resolve(__dirname, 'index.ts'),
      name: 'TsTestRunner',
      formats: ['es'],
      fileName: () => `ts-test-runner/lib/index.js`
    },
    minify: false,
    sourcemap: false,
    rollupOptions: {
      external: (id) => {
        // Externalize Node.js built-ins
        if (id.startsWith('node:')) return true;
        
        // Externalize specific modules
        if (EXTERNALS.includes(id)) return true;
        
        // Externalize all node_modules dependencies
        if (id.includes('node_modules')) return true;
        
        return false;
      },
      output: {
        // Preserve module structure for better tree-shaking
        preserveModules: false,
        // Global variables for UMD build (if needed)
        globals: {
          // Add any global mappings if you decide to add UMD format
        }
      }
    }
  },
  // Ensure TypeScript declarations are generated
  esbuild: {
    // Keep class names for better debugging
    keepNames: true,
  }
});
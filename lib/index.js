import { build as viteBuild } from 'vite';
import { watch } from 'chokidar';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { glob } from 'glob';
import { EventEmitter } from 'events';
import { createServer } from 'http';
import { extname } from 'path';
export class ViteJasminePreprocessor extends EventEmitter {
    config;
    isWatching = false;
    debounceTimer = null;
    constructor(config) {
        super();
        this.config = { browser: 'chrome', port: 8888, ...config };
    }
    createViteConfig() {
        const defaultConfig = {
            root: process.cwd(),
            configFile: false,
            build: {
                outDir: this.config.outDir,
                lib: false,
                rollupOptions: { input: {}, output: { format: 'es', entryFileNames: '[name].js', chunkFileNames: 'chunks/[name]-[hash].js', preserveModules: true, preserveModulesRoot: this.config.srcDir }, preserveEntrySignatures: 'strict' },
                sourcemap: true,
                target: 'es2022',
                minify: false,
                emptyOutDir: true
            },
            resolve: { alias: this.createPathAliases() },
            esbuild: { target: 'es2022', keepNames: false },
            define: { 'process.env.NODE_ENV': '"test"' },
            logLevel: 'warn',
            ...this.config.viteConfig
        };
        return defaultConfig;
    }
    createPathAliases() {
        const aliases = {};
        try {
            const tsconfigPath = this.config.tsconfig || 'tsconfig.json';
            if (fs.existsSync(tsconfigPath)) {
                const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
                const baseUrl = tsconfig.compilerOptions?.baseUrl || '.';
                const paths = tsconfig.compilerOptions?.paths || {};
                for (const [alias, pathArray] of Object.entries(paths)) {
                    if (Array.isArray(pathArray) && pathArray.length > 0) {
                        const cleanAlias = alias.replace(/\/\*$/, '');
                        const cleanPath = pathArray[0].replace(/\/\*$/, '');
                        aliases[cleanAlias] = path.resolve(baseUrl, cleanPath);
                    }
                }
            }
        }
        catch (err) {
            console.warn('⚠️ tsconfig parsing failed:', err);
        }
        return aliases;
    }
    async discoverFiles() {
        const srcPattern = `${this.config.srcDir.replace(/\\/g, '/')}/**/*.ts`;
        const testPattern = `${this.config.testDir.replace(/\\/g, '/')}/**/*.spec.ts`;
        const [srcFiles, testFiles] = await Promise.all([
            glob(srcPattern, { absolute: true, ignore: ['**/node_modules/**', '**/*.spec.ts'] }),
            glob(testPattern, { absolute: true, ignore: ['**/node_modules/**'] })
        ]);
        return { srcFiles, testFiles };
    }
    async preprocess() {
        const { srcFiles, testFiles } = await this.discoverFiles();
        if (testFiles.length === 0)
            throw new Error('No test files found');
        const viteConfig = this.createViteConfig();
        const input = {};
        srcFiles.forEach(file => {
            const rel = path.relative(this.config.srcDir, file).replace(/\.ts$/, '');
            input[`${rel.replace(/[\/\\]/g, '_')}`] = file;
        });
        testFiles.forEach(file => {
            const rel = path.relative(this.config.testDir, file).replace(/\.spec\.ts$/, '');
            input[`${rel.replace(/[\/\\]/g, '_')}.spec`] = file;
        });
        if (!fs.existsSync(this.config.outDir))
            fs.mkdirSync(this.config.outDir, { recursive: true });
        viteConfig.build.rollupOptions.input = input;
        console.log(`📦 Building ${Object.keys(input).length} files...`);
        await viteBuild(viteConfig);
        this.generateHtmlFile();
        console.log('✅ Preprocessing complete');
    }
    generateHtmlFile() {
        const htmlDir = this.config.outDir;
        if (!fs.existsSync(htmlDir))
            fs.mkdirSync(htmlDir, { recursive: true });
        const builtFiles = fs.readdirSync(htmlDir).filter(f => f.endsWith('.js')).sort();
        if (builtFiles.length === 0)
            return console.warn('⚠️ No JS files found for HTML generation.');
        const sourceFiles = builtFiles.filter(f => !f.endsWith('.spec.js'));
        const specFiles = builtFiles.filter(f => f.endsWith('.spec.js'));
        const imports = [...sourceFiles, ...specFiles].map(f => `import "./${f}";`).join('\n        ');
        const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${this.config.htmlOptions?.title || 'Vite + Jasmine Tests'}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/jasmine-core@5.10.0/lib/jasmine-core/jasmine.css">
  <script src="https://cdn.jsdelivr.net/npm/jasmine-core@5.10.0/lib/jasmine-core/jasmine.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/jasmine-core@5.10.0/lib/jasmine-core/jasmine-html.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/jasmine-core@5.10.0/lib/jasmine-core/boot0.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/jasmine-core@5.10.0/lib/jasmine-core/boot1.js"></script>
</head>
<body>
  <div class="jasmine_html-reporter"></div>
  <script type="module">
        ${imports}
  </script>
</body>
</html>`;
        fs.writeFileSync(path.join(htmlDir, 'index.html'), htmlContent);
        console.log('📄 Generated test HTML:', path.join(htmlDir, 'index.html'));
    }
    getContentType(ext) {
        const types = {
            '.html': 'text/html', '.js': 'application/javascript',
            '.css': 'text/css', '.json': 'application/json',
            '.png': 'image/png', '.jpg': 'image/jpeg',
            '.gif': 'image/gif', '.svg': 'image/svg+xml'
        };
        return types[ext] || 'application/octet-stream';
    }
    async startSimpleServer() {
        const port = this.config.port;
        const outDir = this.config.outDir;
        const server = createServer((req, res) => {
            let filePath = req.url === '/' ? '/index.html' : req.url;
            filePath = path.join(outDir, decodeURIComponent(filePath));
            if (fs.existsSync(filePath)) {
                const ext = extname(filePath);
                res.writeHead(200, { 'Content-Type': this.getContentType(ext), 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
                if (req.method === 'OPTIONS') {
                    res.end();
                    return;
                }
                res.end(fs.readFileSync(filePath));
            }
            else {
                res.writeHead(404);
                res.end('Not found');
            }
        });
        server.listen(port, () => {
            console.log(`🚀 Test server running at http://localhost:${port}`);
            console.log('📁 Serving files from:', outDir);
        });
        server.on('error', (err) => console.error('❌ Server error:', err));
    }
    setupFileWatcher() {
        if (this.isWatching)
            return;
        const patterns = [`${this.config.srcDir}/**/*.ts`, `${this.config.testDir}/**/*.ts`];
        const watcher = watch(patterns, { ignoreInitial: true, ignored: ['**/node_modules/**', `**/${this.config.outDir}/**`] });
        watcher.on('all', () => { console.log('🔄 File change detected, rebuilding...'); this.debouncedPreprocess(); });
        this.isWatching = true;
    }
    debouncedPreprocess() {
        if (this.debounceTimer)
            clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(async () => { try {
            await this.preprocess();
            console.log('✅ Rebuild complete');
        }
        catch (err) {
            console.error('❌ Rebuild failed:', err);
        } }, 300);
    }
    async start() {
        console.log('🚀 Starting Vite + Jasmine Test Server...');
        this.config.outDir = path.resolve(this.config.outDir);
        if (!fs.existsSync(this.config.outDir))
            fs.mkdirSync(this.config.outDir, { recursive: true });
        try {
            await this.preprocess();
        }
        catch (err) {
            console.error('❌ Build failed:', err);
            return;
        }
        if (this.config.watch)
            this.setupFileWatcher();
        await this.startSimpleServer();
    }
}
// Factory
export function createViteJasmineRunner(config) {
    return new ViteJasminePreprocessor(config);
}
export function loadViteJasmineBrowserConfig(configPath) {
    const jsonPath = configPath || path.resolve(process.cwd(), 'ts-test-runner.json');
    if (!fs.existsSync(jsonPath)) {
        console.warn('⚠️ ts-test-runner.json not found, using defaults');
        return {};
    }
    try {
        return JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    }
    catch (err) {
        console.error('❌ Failed to parse ts-test-runner.json', err);
        return {};
    }
}
// CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    (async () => {
        const config = loadViteJasmineBrowserConfig();
        const runner = createViteJasmineRunner(config);
        await runner.start();
    })();
}

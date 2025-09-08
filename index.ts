import { build as viteBuild, type InlineConfig } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { glob } from 'glob';
import { EventEmitter } from 'events';
import { createServer } from 'http';
import { extname } from 'path';
import { spawn } from 'child_process';

export interface ViteJasmineConfig {
  srcDir: string;                  // Source files root (e.g., ./src)
  testDir: string;                 // Test files root (e.g., ./spec)
  outDir: string;                  // Output directory for Vite build
  tsconfig?: string;               // Path to tsconfig.json
  port?: number;                   // HTTP server port
  browser?: string;                // Browser name
  headless?: boolean;              // Run in headless mode
  viteConfig?: InlineConfig;       // Custom Vite config overrides
  viteBuildOptions?: {
    target?: string;
    sourcemap?: boolean;
    minify?: boolean;
    preserveModules?: boolean;
    preserveModulesRoot?: string;
  };
  jasmineConfig?: {
    srcFiles?: string[];
    specFiles?: string[];
    helpers?: string[];
    env?: { stopSpecOnExpectationFailure?: boolean; random?: boolean };
    browser?: { name: string; headless?: boolean };
    port?: number;
    reporter?: 'html' | 'console';
    reporters?: Array<{ name: string }>;
    htmlTemplate?: string;
  };
  htmlOptions?: {
    title?: string;
    includeSourceScripts?: boolean;
    includeSpecScripts?: boolean;
    bootScript?: 'boot0' | 'boot1';
  };
}

export class ViteJasminePreprocessor extends EventEmitter {
  private config: ViteJasmineConfig;
  private server: ReturnType<typeof createServer> | null = null;

  constructor(config: ViteJasmineConfig) {
    super();
    this.config = { 
      browser: 'chrome', 
      port: 8888, 
      headless: false, 
      ...config 
    };
  }

  private createViteConfig(): InlineConfig {
    const defaultConfig: InlineConfig = {
      root: process.cwd(),
      configFile: false,
      build: {
        outDir: this.config.outDir,
        lib: false,
        rollupOptions: { 
          input: {}, 
          output: { 
            format: 'es', 
            entryFileNames: '[name].js', 
            chunkFileNames: 'chunks/[name]-[hash].js', 
            preserveModules: true, 
            preserveModulesRoot: this.config.srcDir 
          }, 
          preserveEntrySignatures: 'strict' 
        },
        sourcemap: this.config.viteBuildOptions?.sourcemap ?? true,
        target: this.config.viteBuildOptions?.target ?? 'es2022',
        minify: this.config.viteBuildOptions?.minify ?? false,
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

  private createPathAliases(): Record<string, string> {
    const aliases: Record<string, string> = {};
    try {
      const tsconfigPath = this.config.tsconfig || 'tsconfig.json';
      if (fs.existsSync(tsconfigPath)) {
        const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
        const baseUrl = tsconfig.compilerOptions?.baseUrl || '.';
        const paths = tsconfig.compilerOptions?.paths || {};
        for (const [alias, pathArray] of Object.entries(paths)) {
          if (Array.isArray(pathArray) && pathArray.length > 0) {
            const cleanAlias = alias.replace(/\/\*$/, '');
            const cleanPath = (pathArray[0] as string).replace(/\/\*$/, '');
            aliases[cleanAlias] = path.resolve(baseUrl, cleanPath);
          }
        }
      }
    } catch (err) {
      console.warn('⚠️ tsconfig parsing failed:', err);
    }
    return aliases;
  }

  private async discoverFiles(): Promise<{ srcFiles: string[], testFiles: string[] }> {
    const srcPattern = `${this.config.srcDir.replace(/\\/g, '/')}/**/*.ts`;
    const testPattern = `${this.config.testDir.replace(/\\/g, '/')}/**/*.spec.ts`;

    try {
      const [srcFiles, testFiles] = await Promise.all([
        glob(srcPattern, { absolute: true, ignore: ['**/node_modules/**', '**/*.spec.ts'] }),
        glob(testPattern, { absolute: true, ignore: ['**/node_modules/**'] })
      ]);
      
      return { srcFiles, testFiles };
    } catch (error) {
      console.error('❌ Error discovering files:', error);
      throw new Error('Failed to discover source and test files');
    }
  }

  async preprocess(): Promise<void> {
    try {
      const { srcFiles, testFiles } = await this.discoverFiles();
      if (testFiles.length === 0) {
        throw new Error('No test files found');
      }

      const viteConfig = this.createViteConfig();
      const input: Record<string, string> = {};

      // Add source files
      srcFiles.forEach(file => {
        const relPath = path.relative(this.config.srcDir, file).replace(/\.ts$/, '');
        const key = relPath.replace(/[\/\\]/g, '_');
        input[key] = file;
      });

      // Add test files
      testFiles.forEach(file => {
        const relPath = path.relative(this.config.testDir, file).replace(/\.spec\.ts$/, '');
        const key = `${relPath.replace(/[\/\\]/g, '_')}.spec`;
        input[key] = file;
      });

      // Ensure output directory exists
      if (!fs.existsSync(this.config.outDir)) {
        fs.mkdirSync(this.config.outDir, { recursive: true });
      }

      viteConfig.build!.rollupOptions!.input = input;

      console.log(`📦 Building ${Object.keys(input).length} files...`);
      await viteBuild(viteConfig);

      // Generate appropriate output based on mode
      if (!this.config.headless) {
        this.generateHtmlFile();
      } else {
        this.generateTestRunner();
      }
    } catch (error) {
      console.error('❌ Preprocessing failed:', error);
      throw error;
    }
  }

  private generateHtmlFile(): void {
    const htmlDir = this.config.outDir;
    if (!fs.existsSync(htmlDir)) {
      fs.mkdirSync(htmlDir, { recursive: true });
    }

    const builtFiles = fs.readdirSync(htmlDir)
      .filter(f => f.endsWith('.js'))
      .sort();

    if (builtFiles.length === 0) {
      console.warn('⚠️ No JS files found for HTML generation.');
      return;
    }

    const sourceFiles = builtFiles.filter(f => !f.endsWith('.spec.js'));
    const specFiles = builtFiles.filter(f => f.endsWith('.spec.js'));
    const imports = [...sourceFiles, ...specFiles]
      .map(f => `import "./${f}";`)
      .join('\n        ');

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

    const htmlPath = path.join(htmlDir, 'index.html');
    fs.writeFileSync(htmlPath, htmlContent);
    console.log('📄 Generated test HTML:', htmlPath);
  }

  private generateTestRunner(): void {
    const outDir = this.config.outDir;
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const builtFiles = fs.readdirSync(outDir)
      .filter(f => f.endsWith('.js'))
      .sort();

    if (builtFiles.length === 0) {
      console.warn('⚠️ No JS files found for test runner generation.');
      return;
    }

    const imports = builtFiles
      .map(f => `    await import('./${f}');`)
      .join('\n');

    const runnerContent = `// Auto-generated headless Jasmine test runner
import jasmineCore from 'jasmine-core';
import util from 'util';

/**
 * A reporter that prints spec and suite results to the console.
 */
function ConsoleReporter() {
  let print = (...args) => process.stdout.write(util.format(...args)),
      showColors = true,
      specCount = 0,
      executableSpecCount = 0,
      failureCount = 0,
      failedSpecs = [],
      pendingSpecs = [],
      ansi = { green: '\\x1B[32m', red: '\\x1B[31m', yellow: '\\x1B[33m', none: '\\x1B[0m' };
  
  this.jasmineStarted = function(options) {
    specCount = 0;
    executableSpecCount = 0;
    failureCount = 0;
    failedSpecs = [];
    pendingSpecs = [];
    print('🏃 Executing tests in headless mode...\\n\\n');
  };
  
  this.specDone = function(result) {
    specCount++;
    switch (result.status) {
      case 'passed': 
        executableSpecCount++; 
        print(colored('green', '.')); 
        break;
      case 'failed': 
        failureCount++; 
        failedSpecs.push(result); 
        executableSpecCount++; 
        print(colored('red', 'F')); 
        break;
      case 'pending': 
        pendingSpecs.push(result); 
        executableSpecCount++; 
        print(colored('yellow', '*')); 
        break;
    }
  };

  this.jasmineDone = function(result) {
    const totalTime = result ? result.totalTime / 1000 : 0;

    // Display failures
    if (failedSpecs.length > 0) {
      print('\\n\\n❌ Failures:\\n\\n');
      failedSpecs.forEach((spec, i) => {
        print(\`  \${i + 1}) \${spec.fullName}\\n\`);
        if (spec.failedExpectations?.length > 0) {
          spec.failedExpectations.forEach(expectation => {
            print(\`     \${colored('red', expectation.message)}\\n\`);
          });
        }
      });
    }

    // Display pending specs
    if (pendingSpecs.length > 0) {
      print('\\n\\n⏸️  Pending specs:\\n\\n');
      pendingSpecs.forEach((spec, i) => {
        print(\`  \${i + 1}) \${spec.fullName}\\n\`);
        if (spec.pendingReason) {
          print(\`     \${colored('yellow', spec.pendingReason)}\\n\`);
        }
      });
    }

    // Display summary
    print('\\n📊 Summary: ');
    
    const specsText = executableSpecCount + ' ' + plural('spec', executableSpecCount);
    const failuresText = failureCount + ' ' + plural('failure', failureCount);
    const pendingText = pendingSpecs.length + ' ' + plural('pending spec', pendingSpecs.length);
    
    print(specsText);
    if (failureCount > 0) {
      print(', ' + colored('red', failuresText));
    } else {
      print(', ' + failuresText);
    }
    if (pendingSpecs.length > 0) {
      print(', ' + colored('yellow', pendingText));
    }
    
    print('\\n');
    print('⏱️  Finished in ' + totalTime.toFixed(3) + ' ' + plural('second', totalTime));
    print('\\n\\n');

    // Final status
    if (failureCount === 0 && pendingSpecs.length === 0) {
      print(colored('green', '✅ All specs passed!\\n'));
    } else if (failureCount === 0) {
      print(colored('green', '✅ All specs passed! ') + colored('yellow', '(with ' + pendingSpecs.length + ' pending)\\n'));
    } else {
      print(colored('red', '❌ ' + failureCount + ' ' + plural('spec', failureCount) + ' failed\\n'));
    }

    const exitCode = failureCount === 0 ? 0 : 1;
    process.exit(exitCode);
  };

  function colored(color, str) {
    return showColors ? ansi[color] + str + ansi.none : str;
  }

  function plural(str, count) {
    return count === 1 ? str : str + 's';
  }
}

// Initialize Jasmine
const jasmineRequire = jasmineCore;
const jasmine = jasmineRequire.core(jasmineRequire);
const env = jasmine.getEnv();
Object.assign(globalThis, jasmineRequire.interface(jasmine, env));
globalThis.jasmine = jasmine;

// Configure environment
env.configure({
  random: ${this.config.jasmineConfig?.env?.random ?? true},
  stopOnSpecFailure: ${this.config.jasmineConfig?.env?.stopSpecOnExpectationFailure ?? false}
});

env.clearReporters();
env.addReporter(new ConsoleReporter());

// Global error handlers
process.on('unhandledRejection', error => {
  console.error('❌ Unhandled Rejection:', error);
  process.exit(1);
});

process.on('uncaughtException', error => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Import and execute specs
(async function() {
  try {
${imports}
    env.execute();
  } catch (error) {
    console.error('❌ Error during test execution:', error);
    process.exit(1);
  }
})();
`;

    fs.writeFileSync(path.join(outDir, 'test-runner.js'), runnerContent);
    console.log('🤖 Generated headless test runner:', path.join(outDir, 'test-runner.js'));
  }

  private async runHeadlessTests(): Promise<boolean> {
    return new Promise((resolve) => {
      const testRunnerPath = path.join(this.config.outDir, 'test-runner.js');
      
      if (!fs.existsSync(testRunnerPath)) {
        console.error('❌ Test runner not found. Build may have failed.');
        resolve(false);
        return;
      }
      
      const child = spawn('node', [testRunnerPath], {
        stdio: 'inherit',
        cwd: process.cwd(),
        env: {
          ...process.env,
          NODE_ENV: 'test'
        }
      });

      child.on('close', (code) => {
        const success = code === 0;
        resolve(success);
      });

      child.on('error', (error) => {
        console.error('❌ Failed to run headless tests:', error);
        resolve(false);
      });
    });
  }

  private getContentType(ext: string): string {
    const types: Record<string, string> = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon'
    };
    return types[ext] || 'application/octet-stream';
  }

  private async startSimpleServer(): Promise<void> {
    const port = this.config.port!;
    const outDir = this.config.outDir;

    this.server = createServer((req, res) => {
      let filePath = req.url === '/' ? '/index.html' : req.url!;
      filePath = path.join(outDir, decodeURIComponent(filePath));

      // Handle CORS preflight requests
      if (req.method === 'OPTIONS') {
        res.writeHead(200, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end();
        return;
      }

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = extname(filePath);
        res.writeHead(200, {
          'Content-Type': this.getContentType(ext),
          'Access-Control-Allow-Origin': '*'
        });
        res.end(fs.readFileSync(filePath));
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    return new Promise((resolve, reject) => {
      this.server!.listen(port, () => {
        console.log(`🚀 Test server running at http://localhost:${port}`);
        console.log('📁 Serving files from:', outDir);
        resolve();
      });

      this.server!.on('error', (error) => {
        console.error('❌ Server error:', error);
        reject(error);
      });
    });
  }

  async cleanup(): Promise<void> {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  async start(): Promise<void> {
    console.log(`🚀 Starting Vite + Jasmine Test ${this.config.headless ? 'Runner (Headless)' : 'Server'}...`);
    
    // Ensure absolute paths
    this.config.outDir = path.resolve(this.config.outDir);
    this.config.srcDir = path.resolve(this.config.srcDir);
    this.config.testDir = path.resolve(this.config.testDir);

    if (!fs.existsSync(this.config.outDir)) {
      fs.mkdirSync(this.config.outDir, { recursive: true });
    }

    try {
      await this.preprocess();
    } catch (error) {
      console.error('❌ Build failed:', error);
      process.exit(1);
    }

    if (this.config.headless) {
      // Headless mode: run tests and exit
      const success = await this.runHeadlessTests();
      process.exit(success ? 0 : 1);
    } else {
      // Browser mode: start server and keep running
      await this.startSimpleServer();
      
      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        console.log('\n🛑 Shutting down...');
        await this.cleanup();
        process.exit(0);
      });
    }
  }
}

// Factory function
export function createViteJasmineRunner(config: ViteJasmineConfig): ViteJasminePreprocessor {
  return new ViteJasminePreprocessor(config);
}

export function loadViteJasmineBrowserConfig(configPath?: string): ViteJasmineConfig {
  const jsonPath = configPath || path.resolve(process.cwd(), 'ts-test-runner.json');
  
  if (!fs.existsSync(jsonPath)) {
    console.warn('⚠️ ts-test-runner.json not found, using defaults');
    return {} as ViteJasmineConfig;
  }
  
  try {
    return JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  } catch (error) {
    console.error('❌ Failed to parse ts-test-runner.json', error);
    return {} as ViteJasmineConfig;
  }
}

// CLI entry point
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  (async () => {
    try {
      const config = loadViteJasmineBrowserConfig();
      const runner = createViteJasmineRunner(config);
      await runner.start();
    } catch (error) {
      console.error('❌ Failed to start test runner:', error);
      process.exit(1);
    }
  })();
}
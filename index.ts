import { build as viteBuild, type InlineConfig } from 'vite';
import path from 'path';
import fs from 'fs';
import http from 'http';
import util from 'util';
import { fileURLToPath } from 'url';
import { glob } from 'glob';
import { EventEmitter } from 'events';
import { createServer } from 'http';
import { extname } from 'path';
import { spawn } from 'child_process';
import { WebSocketServer, WebSocket } from 'ws';

export class ConsoleReporter {
  private print: (...args: any[]) => void;
  private showColors: boolean;
  private specCount: number;
  private executableSpecCount: number;
  private failureCount: number;
  private failedSpecs: any[];
  private pendingSpecs: any[];
  private ansi: Record<string, string>;

  constructor() {
    this.print = (...args) => process.stdout.write(util.format(...args));
    this.showColors = true;
    this.specCount = 0;
    this.executableSpecCount = 0;
    this.failureCount = 0;
    this.failedSpecs = [];
    this.pendingSpecs = [];
    this.ansi = { 
      green: '\x1B[32m', 
      red: '\x1B[31m', 
      yellow: '\x1B[33m', 
      none: '\x1B[0m' 
    };
  }

  jasmineStarted(options: any) {
    this.specCount = 0;
    this.executableSpecCount = 0;
    this.failureCount = 0;
    this.failedSpecs = [];
    this.pendingSpecs = [];
    this.print('🏃 Executing tests...\n\n');
  }

  specDone(result: any) {
    this.specCount++;
    
    switch (result.status) {
      case 'passed': 
        this.executableSpecCount++; 
        this.print(this.colored('green', '.')); 
        break;
      case 'failed': 
        this.failureCount++; 
        this.failedSpecs.push(result); 
        this.executableSpecCount++; 
        this.print(this.colored('red', 'F')); 
        break;
      case 'pending': 
        this.pendingSpecs.push(result); 
        this.executableSpecCount++; 
        this.print(this.colored('yellow', '*')); 
        break;
    }
  }

  jasmineDone(result: any) {
    const totalTime = result ? result.totalTime / 1000 : 0;
    const failedSpecsPresent = this.failedSpecs.length > 0;
    const pendingSpecsPresent = this.pendingSpecs.length > 0;

    // Display failures
    if (failedSpecsPresent) {
      this.print('\n\n❌ Failures:\n\n');
      this.failedSpecs.forEach((spec, i) => {
        this.print(`  ${i + 1}) ${spec.fullName}\n`);
        if (spec.failedExpectations?.length > 0) {
          spec.failedExpectations.forEach((expectation: any) => {
            this.print(`     ${this.colored('red', expectation.message)}\n`);
          });
        }
      });
    }

    // Display pending specs
    if (pendingSpecsPresent) {
      this.print(`${failedSpecsPresent ? '\n': '\n\n'}⏸️  Pending specs:\n\n`);
      this.pendingSpecs.forEach((spec, i) => {
        this.print(`  ${i + 1}) ${spec.fullName}\n`);
        if (spec.pendingReason) {
          this.print(`     ${this.colored('yellow', spec.pendingReason)}\n`);
        }
      });
    }

    // Display summary
    this.print(`${failedSpecsPresent || pendingSpecsPresent ? '\n': '\n\n'}📊 Summary: `);

    const specsText = this.executableSpecCount + ' ' + this.plural('spec', this.executableSpecCount);
    const failuresText = this.failureCount + ' ' + this.plural('failure', this.failureCount);
    const pendingText = this.pendingSpecs.length + ' ' + this.plural('pending spec', this.pendingSpecs.length);
    
    this.print(specsText);
    if (this.failureCount > 0) {
      this.print(', ' + this.colored('red', failuresText));
    } else {
      this.print(', ' + failuresText);
    }
    if (this.pendingSpecs.length > 0) {
      this.print(', ' + this.colored('yellow', pendingText));
    }
    
    this.print('\n');
    this.print('⏱️  Finished in ' + totalTime.toFixed(3) + ' ' + this.plural('second', totalTime));
    this.print('\n\n');

    // Final status
    if (this.failureCount === 0 && this.pendingSpecs.length === 0) {
      this.print(this.colored('green', '✅ All specs passed!\n'));
    } else if (this.failureCount === 0) {
      this.print(this.colored('green', '✅ All specs passed! ') + this.colored('yellow', '(with ' + this.pendingSpecs.length + ' pending)\n'));
    } else {
      this.print(this.colored('red', '❌ ' + this.failureCount + ' ' + this.plural('spec', this.failureCount) + ' failed\n'));
    }

    return this.failureCount;
  }

  private colored(color: string, str: string): string {
    return this.showColors ? this.ansi[color] + str + this.ansi.none : str;
  }

  private plural(str: string, count: number): string {
    return count === 1 ? str : str + 's';
  }
}

export interface ViteJasmineConfig {
  srcDir: string;
  testDir: string;
  outDir: string;
  tsconfig?: string;
  port?: number;
  browser?: string;
  headless?: boolean;
  viteConfig?: InlineConfig;
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
    env?: { stopSpecOnExpectationFailure?: boolean; random?: boolean; timeout?: number; };
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
  private wss: WebSocketServer | null = null;
  private wsClients: WebSocket[] = [];
  private consoleReporter: ConsoleReporter | null = null;
  private finalResult: any = null;
  private testCompleted: boolean = false;
  private testSuccess: boolean = false;

  constructor(config: ViteJasmineConfig) {
    super();
    this.config = { 
      browser: 'chrome', 
      port: 8888, 
      headless: false, 
      ...config 
    };
  }

  private createWebSocketServer(): void {
    if (!this.server) return;
    
    this.wss = new WebSocketServer({ server: this.server });
    
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('🔌 WebSocket client connected');
      this.wsClients.push(ws);
      
      // Handle incoming messages from browser
      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleWebSocketMessage(message);
        } catch (error) {
          console.error('❌ Failed to parse WebSocket message:', error);
        }
      });
      
      ws.on('close', () => {
        this.wsClients = this.wsClients.filter(client => client !== ws);
      });
      
      ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
        this.wsClients = this.wsClients.filter(client => client !== ws);
      });
    });
  }

  private handleWebSocketMessage(message: any): void {
    if (!this.consoleReporter) {
      this.consoleReporter = new ConsoleReporter();
    }

    try {
      switch (message.type) {
        case 'start':
          this.consoleReporter.jasmineStarted({ 
            totalSpecsDefined: message.totalSpecs || 0 
          });
          break;
          
        case 'specDone':
          // Forward the spec result to console reporter
          this.consoleReporter.specDone({
            id: message.id,
            description: message.description,
            fullName: message.fullName,
            status: message.status,
            passedExpectations: message.passedExpectations || [],
            failedExpectations: message.failedExpectations || [],
            pendingReason: message.pendingReason || null,
            duration: message.duration || 0
          });
          break;
          
        case 'done':
          this.finalResult = message;
          
          // Call jasmineDone and get failure count
          const failureCount = this.consoleReporter.jasmineDone({
            totalTime: message.totalTime || 0,
            overallStatus: message.overallStatus || 'complete',
            incompleteReason: message.incompleteReason || null,
            order: message.order || null
          });
          
          // Set flags that tests are finished (for browser waiting)
          this.testCompleted = true;
          this.testSuccess = failureCount === 0;
          break;
          
        default:
          console.warn('⚠️ Unknown WebSocket message type:', message.type);
      }
    } catch (error) {
      console.error('❌ Error handling WebSocket message:', error);
    }
  }

  private async runHeadlessBrowserTests(browserType: any): Promise<boolean> {
    const browser = await browserType.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    page.setDefaultTimeout(0);

    // Set up console message handling
    page.on('console', (msg: any) => {
      const text = msg.text();
      const type = msg.type();
      
      // Filter out WebSocket debug messages but keep important ones
      if (!text.includes('WebSocket') || text.includes('error') || text.includes('failed')) {
        if (type === 'error') {
          console.error('BROWSER ERROR:', text);
        } else if (type === 'warn') {
          console.warn('BROWSER WARN:', text);
        }
      }
    });

    // Handle page errors
    page.on('pageerror', (error: any) => {
      console.error('❌ Page error:', error.message);
    });

    page.on('requestfailed', (request: any) => {
      console.error('❌ Request failed:', request.url(), request.failure()?.errorText);
    });

    console.log('🌐 Navigating to test page...');
    await page.goto(`http://localhost:${this.config.port}/index.html`, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    try {
      // Wait for tests to complete with a reasonable timeout
      await page.waitForFunction(
        () => (window as any).jasmineFinished === true,
        { timeout: this.config.jasmineConfig?.env?.timeout ?? 120000 }
      );

      // Wait a bit more for any final messages
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check if we have results via WebSocket
      if (!this.testCompleted) {
        throw new Error('Tests completed but no results received via WebSocket');
      }

      await browser.close();
      return this.testSuccess;

    } catch (error) {
      console.error('❌ Test execution failed:', error);
      await browser.close();
      throw error;
    }
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

      // Generate HTML for both modes - needed for headless browser too
      this.generateHtmlFile();

      // Generate test runner only for Node.js headless mode
      if (this.config.headless && this.config.browser === 'node') {
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
  <script>
    function WebSocketEventForwarder() {
      this.ws = null;
      this.connected = false;
      this.messageQueue = [];
      
      this.connect = function() {
        try {
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          const wsUrl = protocol + '//' + window.location.host;
          console.log('Connecting to WebSocket:', wsUrl);
          
          this.ws = new WebSocket(wsUrl);
          
          this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.connected = true;
            
            // Send any queued messages
            while (this.messageQueue.length > 0) {
              const queuedMessage = this.messageQueue.shift();
              this.send(queuedMessage);
            }
          };
          
          this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            this.connected = false;
          };
          
          this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.connected = false;
          };
        } catch (error) {
          console.error('Failed to create WebSocket:', error);
        }
      };
      
      this.send = function(message) {
        if (this.connected && this.ws && this.ws.readyState === WebSocket.OPEN) {
          try {
            this.ws.send(JSON.stringify(message));
            console.log('Sent WebSocket message:', message.type);
          } catch (error) {
            console.error('Failed to send WebSocket message:', error);
          }
        } else {
          // Queue message if not connected
          console.log('Queuing message (not connected):', message.type);
          this.messageQueue.push(message);
        }
      };
      
      this.jasmineStarted = function(suiteInfo) {
        console.log('Jasmine started with', suiteInfo.totalSpecsDefined, 'specs');
        this.connect();
        
        this.send({
          type: 'start',
          totalSpecs: suiteInfo.totalSpecsDefined,
          order: suiteInfo.order,
          timestamp: Date.now()
        });
      };
      
      this.specDone = function(result) {
        console.log('Spec completed:', result.fullName, '(' + result.status + ')');
        
        this.send({
          type: 'specDone',
          id: result.id,
          description: result.description,
          fullName: result.fullName,
          status: result.status,
          passedExpectations: result.passedExpectations || [],
          failedExpectations: result.failedExpectations || [],
          pendingReason: result.pendingReason || null,
          duration: result.duration || 0,
          timestamp: Date.now()
        });
      };
      
      this.jasmineDone = function(result) {
        console.log('Jasmine completed');
        
        this.send({
          type: 'done',
          totalTime: result.totalTime || 0,
          overallStatus: result.overallStatus || 'complete',
          incompleteReason: result.incompleteReason || null,
          order: result.order || null,
          timestamp: Date.now()
        });
        
        // Set global flag for headless browser detection
        window.jasmineFinished = true;
        
        // Close WebSocket after a short delay
        setTimeout(() => {
          if (this.ws) {
            this.ws.close();
          }
        }, 1000);
      };
    }
    
    // Add the WebSocket forwarder as a reporter
    jasmine.getEnv().addReporter(new WebSocketEventForwarder());
  </script>
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
    console.log('📄 Generated test HTML with WebSocket forwarding:', htmlPath);
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

// Console Reporter class
export class ConsoleReporter {
  print;
  showColors;
  specCount;
  executableSpecCount;
  failureCount;
  failedSpecs;
  pendingSpecs;
  ansi;

  constructor() {
    this.print = (...args) => process.stdout.write(util.format(...args));
    this.showColors = true;
    this.specCount = 0;
    this.executableSpecCount = 0;
    this.failureCount = 0;
    this.failedSpecs = [];
    this.pendingSpecs = [];
    this.ansi = {
      green: '\\x1B[32m',
      red: '\\x1B[31m',
      yellow: '\\x1B[33m',
      none: '\\x1B[0m'
    };
  }

  jasmineStarted(options) {
    this.specCount = 0;
    this.executableSpecCount = 0;
    this.failureCount = 0;
    this.failedSpecs = [];
    this.pendingSpecs = [];
    this.print('🏃 Executing tests...\\n\\n');
  }

  specDone(result) {
    this.specCount++;
    switch (result.status) {
      case 'passed':
        this.executableSpecCount++;
        this.print(this.colored('green', '.'));
        break;
      case 'failed':
        this.failureCount++;
        this.failedSpecs.push(result);
        this.executableSpecCount++;
        this.print(this.colored('red', 'F'));
        break;
      case 'pending':
        this.pendingSpecs.push(result);
        this.executableSpecCount++;
        this.print(this.colored('yellow', '*'));
        break;
    }
  }

  jasmineDone(result) {
    const totalTime = result ? result.totalTime / 1000 : 0;
    const failedSpecsPresent = this.failedSpecs.length > 0;
    const pendingSpecsPresent = this.pendingSpecs.length > 0;

    // Display failures
    if (failedSpecsPresent) {
      this.print('\\n\\n❌ Failures:\\n\\n');
      this.failedSpecs.forEach((spec, i) => {
        this.print(\`  \${i + 1}) \${spec.fullName}\\n\`);
        if (spec.failedExpectations?.length > 0) {
          spec.failedExpectations.forEach((expectation) => {
            this.print(\`     \${this.colored('red', expectation.message)}\\n\`);
          });
        }
      });
    }

    // Display pending specs
    if (pendingSpecsPresent) {
      this.print(\`\${failedSpecsPresent ? '\\n': '\\n\\n'}⏸️  Pending specs:\\n\\n\`);
      this.pendingSpecs.forEach((spec, i) => {
        this.print(\`  \${i + 1}) \${spec.fullName}\\n\`);
        if (spec.pendingReason) {
          this.print(\`     \${this.colored('yellow', spec.pendingReason)}\\n\`);
        }
      });
    }

    // Display summary
    this.print(\`\${failedSpecsPresent || pendingSpecsPresent ? '\\n': '\\n\\n'}📊 Summary: \`);

    const specsText = this.executableSpecCount + ' ' + this.plural('spec', this.executableSpecCount);
    const failuresText = this.failureCount + ' ' + this.plural('failure', this.failureCount);
    const pendingText = this.pendingSpecs.length + ' ' + this.plural('pending spec', this.pendingSpecs.length);
    
    this.print(specsText);
    if (this.failureCount > 0) {
      this.print(', ' + this.colored('red', failuresText));
    } else {
      this.print(', ' + failuresText);
    }
    if (this.pendingSpecs.length > 0) {
      this.print(', ' + this.colored('yellow', pendingText));
    }
    
    this.print('\\n');
    this.print('⏱️  Finished in ' + totalTime.toFixed(3) + ' ' + this.plural('second', totalTime));
    this.print('\\n\\n');

    // Final status
    if (this.failureCount === 0 && this.pendingSpecs.length === 0) {
      this.print(this.colored('green', '✅ All specs passed!\\n'));
    } else if (this.failureCount === 0) {
      this.print(this.colored('green', '✅ All specs passed! ') + this.colored('yellow', '(with ' + this.pendingSpecs.length + ' pending)\\n'));
    } else {
      this.print(this.colored('red', '❌ ' + this.failureCount + ' ' + this.plural('spec', this.failureCount) + ' failed\\n'));
    }

    return this.failureCount;
  }

  colored(color, str) {
    return this.showColors ? this.ansi[color] + str + this.ansi.none : str;
  }

  plural(str, count) {
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
    await env.execute();
  } catch (error) {
    console.error('❌ Error during test execution:', error);
    setImmediate(() => process.exit(1));
  } finally {
    // get failure count from the reporter
    const reporter = env.reporter; // if you keep a reference to your ConsoleReporter
    const failures = reporter ? reporter.failureCount : 0;

    setImmediate(() => process.exit(failures === 0 ? 0 : 1));
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

      // Remove the duplicate exit handler
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

  private async checkBrowser(browserName: string): Promise<any | null> {
    let browser: any = null;

    try {
      // Try to dynamically import Playwright
      const playwright = await import('playwright');

      switch (browserName.toLowerCase()) {
        case 'chromium':
        case 'chrome':
          browser = playwright.chromium;
          break;
        case 'firefox':
          browser = playwright.firefox;
          break;
        case 'webkit':
        case 'safari':
          browser = playwright.webkit;
          break;
        default:
          console.warn(`⚠️ Unknown browser "${browserName}", falling back to Node.js mode`);
          return null;
      }

      // Check if the executable exists
      const exePath = browser.executablePath();
      if (!exePath || !fs.existsSync(exePath)) {
        console.error(`❌ Browser "${browserName}" is not installed.`);
        console.log(`💡 Tip: Install it by running:\n   npx playwright install ${browserName.toLowerCase()}`);
        return null;
      }

      return browser;
    } catch (err: any) {
      if (err.code === 'MODULE_NOT_FOUND') {
        console.log(`ℹ️ Playwright not installed. Browser "${browserName}" not available.`);
        console.log(`💡 Tip: Install Playwright to enable browser testing:\n   npm install playwright`);
      } else {
        console.error(`❌ Browser execution failed for "${browserName}": ${err.message}`);
      }
      return null;
    }
  }

  private async waitForServerReady(url: string, timeout = 5000): Promise<void> {
    const start = Date.now();
    const { hostname, port } = new URL(url);

    console.log(`⏳ Waiting for server to be ready at ${url}...`);

    while (Date.now() - start < timeout) {
      try {
        await new Promise<void>((resolve, reject) => {
          const req = http.request({
            hostname,
            port,
            path: '/',
            method: 'HEAD',
            timeout: 1000
          }, (res) => {
            res.resume();
            resolve();
          });

          req.on("error", reject);
          req.on("timeout", () => {
            req.destroy();
            reject(new Error('Timeout'));
          });

          req.end();
        });
        return; // success - no console.log here
      } catch {
        await new Promise(r => setTimeout(r, 100));
      }
    }
    throw new Error(`Server not ready at ${url} after ${timeout}ms`);
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

    this.createWebSocketServer();

    return new Promise((resolve, reject) => {
      this.server!.listen(port, () => {
        console.log(`🚀 Test server running at http://localhost:${port}`);
        console.log('📡 WebSocket server ready for real-time test reporting');
        resolve();
      });

      this.server!.on('error', (error) => {
        console.error('❌ Server error:', error);
        reject(error);
      });
    });
  }

  async cleanup(): Promise<void> {
    if (this.wss) {
      await new Promise<void>(resolve => this.wss!.close(() => resolve()));
      this.wss = null;
    }
    if (this.server) {
      await new Promise<void>((resolve, reject) => {
        this.server!.close(err => (err ? reject(err) : resolve()));
      });
      this.server = null;
    }
    this.wsClients = [];
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

    // Handle headless browser mode
    if (this.config.headless && this.config.browser !== 'node') {
      await this.startSimpleServer();
      await this.waitForServerReady(`http://localhost:${this.config.port}/index.html`, 10000);

      // Initialize the console reporter
      this.consoleReporter = new ConsoleReporter();

      let browserType = null;
      try {
        browserType = await this.checkBrowser(this.config.browser!);
      } catch (error: any) {
        console.log(`⚠️ Browser detection failed: ${error.message}`);
      }

      if (!browserType) {
        console.log('⚠️ Headless browser not available. Falling back to Node.js runner.');
        this.config.browser = 'node';
        this.generateTestRunner();
        const success = await this.runHeadlessTests();
        await this.cleanup();
        process.exit(success ? 0 : 1);
      }

      try {
        const success = await this.runHeadlessBrowserTests(browserType);
        await this.cleanup();
        process.exit(success ? 0 : 1);
      } catch (error) {
        console.error('❌ Browser test execution failed:', error);
        await this.cleanup();
        process.exit(1);
      }
    }
    // Handle Node.js headless mode
    else if (this.config.headless && this.config.browser === 'node') {
      const success = await this.runHeadlessTests();
      process.exit(success ? 0 : 1);
    }
    // Handle regular browser mode (headed)
    else {
      await this.startSimpleServer();
      console.log('📊 Open the above URL in your browser to run tests');
      console.log('⏹️  Press Ctrl+C to stop the server');

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
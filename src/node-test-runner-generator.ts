import * as fs from 'fs';
import * as path from 'path';
import http from 'http';
import { ViteJasmineConfig } from "./vite-jasmine-config";
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';
import { WebSocketServer, WebSocket } from 'ws';
import { norm } from './utils';

export class NodeTestRunnerGenerator {
  constructor(private config: ViteJasmineConfig) {}

  generateTestRunner(): void {
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

    const runnerContent = this.generateRunnerTemplate(imports);
    fs.writeFileSync(norm(path.join(outDir, 'test-runner.js')), runnerContent);
    console.log('🤖 Generated headless test runner:', norm(path.join(outDir, 'test-runner.js')));
  }

  private generateRunnerTemplate(imports: string): string {
    return `// Auto-generated headless Jasmine test runner
import * as path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
const __filename = "${fileURLToPath(import.meta.url).replace(/\\/g, '/')}";
const __dirname = path.dirname(__filename).replace(/\\\\/g, '/');

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
  const { ConsoleReporter } = await import(pathToFileURL(path.join(__dirname, '../lib/index.js')).href);
  const jasmineCore = await import(pathToFileURL(path.join(__dirname, '../vendor/jasmine-core/lib/jasmine-core/jasmine.js')).href);

  // Initialize Jasmine
  const jasmineRequire = jasmineCore.default;
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
  const consoleReporter = new ConsoleReporter();
  env.addReporter(consoleReporter);

  try {
${imports}
    await env.execute();
  } catch (error) {
    console.error('❌ Error during test execution:', error);
    setImmediate(() => process.exit(1));
  } finally {
    // get failure count from the reporter
    const failures = consoleReporter.failureCount || 0;;

    setImmediate(() => process.exit(failures === 0 ? 0 : 1));
  }
})();
`;
  }
}

// === WebSocket Manager ===
export class WebSocketManager extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private wsClients: WebSocket[] = [];

  constructor(private server: http.Server, private consoleReporter: any) {
    super();
    this.createWebSocketServer();
  }

  private createWebSocketServer(): void {
    this.wss = new WebSocketServer({ server: this.server });
    
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('🔌 WebSocket client connected');
      this.wsClients.push(ws);
      
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
    try {
      switch (message.type) {
        case 'start':
          this.consoleReporter?.jasmineStarted({ 
            totalSpecsDefined: message.totalSpecs || 0 
          });
          break;
          
        case 'specDone':
          this.consoleReporter?.specDone({
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
          const failureCount = this.consoleReporter?.jasmineDone({
            totalTime: message.totalTime || 0,
            overallStatus: message.overallStatus || 'complete',
            incompleteReason: message.incompleteReason || null,
            order: message.order || null
          });
          
          this.emit('testsCompleted', { success: failureCount === 0 });
          break;
          
        default:
          console.warn('⚠️ Unknown WebSocket message type:', message.type);
      }
    } catch (error) {
      console.error('❌ Error handling WebSocket message:', error);
    }
  }

  async cleanup(): Promise<void> {
    if (this.wss) {
      await new Promise<void>(resolve => this.wss!.close(() => resolve()));
      this.wss = null;
    }
    this.wsClients = [];
  }
}
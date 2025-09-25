import { fileURLToPath } from 'url';

const vite = await import("vite");
const { build: viteBuild } = vite;
import { CLIHandler } from './cli-handler';

export { BrowserManager } from './browser-manager';
export { CLIHandler } from './cli-handler';
export { ConfigManager } from './config-manager';
export { ConsoleReporter } from './console-reporter';
export { FileDiscoveryService } from './file-discovery-service';
export { HtmlGenerator } from './html-generator';
export { HttpServerManager } from './http-server-manager';
export { NodeTestRunnerGenerator } from './node-test-runner-generator';
export { NodeTestRunner } from './node-test-runner';
export { norm } from './utils';
export { ViteConfigBuilder } from './vite-config-builder';
export type { ViteJasmineConfig } from './vite-jasmine-config';
export { ViteJasminePreprocessor } from './vite-jasmine-preprocessor';

// === CLI Entry Point ===
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  CLIHandler.run();
}
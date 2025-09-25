import { glob } from "glob";
import { ViteJasmineConfig } from "./vite-jasmine-config";

export class FileDiscoveryService {
  constructor(private config: ViteJasmineConfig) {}

  async discoverFiles(): Promise<{ srcFiles: string[], testFiles: string[] }> {
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
}

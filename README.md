# TypeScript Test Runner

A simple, browser-based test runner for TypeScript projects using Jasmine. Run your TypeScript tests directly in the browser without complex configuration.

## What it does

This tool compiles your TypeScript test files and runs them in a real browser environment using Jasmine. Perfect for testing browser-specific code or when you want to see your tests run in an actual browser.

## Installation

```bash
npm install --save-dev @actioncrew/ts-test-runner jasmine-core
```

## Quick Start

1. **Initialize configuration**: Creates a `ts-test-runner.json` file with sensible defaults
   ```bash
   npx ts-test-runner init
   ```

2. **Run tests**: Starts a local server and opens your tests in a browser
   ```bash
   npx ts-test-runner
   ```
   Then visit http://localhost:8888 to see your test results

## Commands

| Command | Description |
|---------|-------------|
| `npx ts-test-runner` | Run all tests (default behavior) |
| `npx ts-test-runner init` | Initialize test configuration file |
| `npx ts-test-runner --config <path>` | Run tests with custom config file |
| `npx ts-test-runner --help` | Show help information |

## Project Structure

The test runner expects this basic structure:

```
your-project/
├── projects/
│   └── your-library/
│       └── src/
│           ├── lib/           # Your TypeScript source files
│           └── tests/         # Your .spec.ts test files
├── dist/
│   └── .vite-jasmine-build/   # Compiled output (auto-generated)
├── ts-test-runner.json        # Configuration (created by init)
└── package.json               # Project metadata
```

## Configuration

The `ts-test-runner.json` file is automatically generated with your project name from `package.json`:

```json
{
  "srcDir": "./projects/libraries/src/lib",
  "testDir": "./projects/libraries/src/tests", 
  "outDir": "./dist/.vite-jasmine-build",
  "tsconfig": "tsconfig.json",
  "port": 8888,
  "browser": "chrome",
  "watch": true,
  "htmlOptions": {
    "title": "your-project-name - Vite + Jasmine Tests"
  }
}
```

### Advanced Configuration

The configuration supports advanced Vite and Jasmine options:

- **Vite Integration**: Full Vite build configuration with ES2022 support
- **Source Maps**: Enabled for debugging TypeScript in browser
- **Module Preservation**: Maintains your module structure in output
- **Watch Mode**: Auto-reload tests when files change
- **Custom Browser**: Choose between Chrome, Firefox, Safari, etc.

### Custom Config File

Use a different config file:

```bash
npx ts-test-runner --config ./custom-ts-test-runner.json
```

## Writing Tests

Create `.spec.ts` files in your test directory:

```typescript
// tests/example.spec.ts
import { myFunction } from '../lib/my-module';

describe('My Module', () => {
  it('should work correctly', () => {
    expect(myFunction()).toBe('expected result');
  });

  it('should handle edge cases', () => {
    expect(myFunction(null)).toBeNull();
  });
});
```

## Features

- ✅ **TypeScript Support**: Full TypeScript compilation with type checking
- ✅ **Browser Testing**: Real browser environment for accurate testing
- ✅ **Live Reloading**: Watch mode for development workflow
- ✅ **Source Maps**: Debug TypeScript directly in browser DevTools  
- ✅ **Project Name Detection**: Automatically uses your package.json name
- ✅ **Modern ES Modules**: ESM support with proper module resolution
- ✅ **Customizable**: Flexible configuration for different project structures
- ✅ **Simple Setup**: One command initialization

## Why Use This?

- **Browser-First**: Test TypeScript code in real browser environments
- **Zero Config**: Works out of the box with sensible defaults
- **Development Friendly**: Live reloading and watch mode for fast iteration
- **Modern TypeScript**: Works with latest TypeScript features (ES2022+)
- **Lightweight Alternative**: Simple alternative to heavy test frameworks like Jest/Vitest
- **Visual Feedback**: HTML test reports with clear pass/fail indicators

## Troubleshooting

### Port Already in Use
If port 8888 is busy, change it in `ts-test-runner.json`:
```json
{
  "port": 3000
}
```

### TypeScript Compilation Errors
Make sure your `tsconfig.json` is properly configured for your project structure.

### Tests Not Found
Verify your test files:
- Are in the correct `testDir` location
- Have `.spec.ts` extension
- Export proper Jasmine test suites

## Examples

### Basic Test
```typescript
describe('Calculator', () => {
  it('adds numbers correctly', () => {
    expect(2 + 2).toBe(4);
  });
});
```

### Async Test
```typescript
describe('API Client', () => {
  it('fetches data', async () => {
    const data = await fetchUserData(123);
    expect(data.name).toBeTruthy();
  });
});
```

### DOM Testing
```typescript
describe('UI Component', () => {
  it('creates DOM elements', () => {
    const button = document.createElement('button');
    button.textContent = 'Click me';
    expect(button.textContent).toBe('Click me');
  });
});
```

## License

MIT © 2025
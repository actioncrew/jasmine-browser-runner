# TypeScript Test Runner

A simple test runner for TypeScript projects using Jasmine. Run your tests in multiple environments: **in the browser** (with HTML reporter), **headless browsers** (via Playwright), or **directly in Node.js** — all without complex configuration.

## What it does

This tool compiles your TypeScript test files and runs them in various environments using Jasmine. Perfect for testing browser-specific code, CI/CD pipelines, or when you want to see your tests run in an actual browser.

## Installation

```bash
npm install --save-dev @actioncrew/ts-test-runner jasmine-core
```

For headless browser testing, also install Playwright:
```bash
npm install --save-dev playwright
npx playwright install
```

## Quick Start

1. **Initialize configuration**: Creates a `ts-test-runner.json` file with sensible defaults
   ```bash
   npx ts-test-runner init
   ```

2. **Run tests**: Choose your preferred execution mode
   ```bash
   # Browser mode - opens tests in browser
   npx ts-test-runner
   
   # Headless browser mode - runs in background
   npx ts-test-runner --headless
   
   # Node.js mode - fastest execution
   npx ts-test-runner --headless --browser node
   ```

## Commands

| Command | Description |
|---------|-------------|
| `npx ts-test-runner` | Run tests in browser (default) |
| `npx ts-test-runner --headless` | Run tests in headless Chrome |
| `npx ts-test-runner --headless --browser firefox` | Run tests in headless Firefox |
| `npx ts-test-runner --headless --browser webkit` | Run tests in headless Safari/WebKit |
| `npx ts-test-runner --headless --browser node` | Run tests directly in Node.js |
| `npx ts-test-runner init` | Initialize test configuration file |
| `npx ts-test-runner --config <path>` | Use custom config file |
| `npx ts-test-runner --help` | Show help information |

## Execution Modes

### 1. Browser Mode (Default)
Perfect for development and debugging:
- Opens tests in your default browser
- Full HTML reporter with interactive UI
- Real-time test progress and results
- Browser DevTools for debugging

```bash
npx ts-test-runner
# Then visit http://localhost:8888
```

### 2. Headless Browser Mode
Ideal for CI/CD and automated testing:
- Runs tests in real browser environments without UI
- Full browser API support (DOM, fetch, etc.)
- Console output with progress indicators
- Supports Chrome, Firefox, and Safari/WebKit

```bash
# Chrome (default)
npx ts-test-runner --headless

# Firefox
npx ts-test-runner --headless --browser firefox

# Safari/WebKit
npx ts-test-runner --headless --browser webkit
```

### 3. Node.js Mode
Fastest execution for pure logic testing:
- Direct Node.js execution
- No browser overhead
- Limited to Node.js APIs only
- Best for unit tests without DOM dependencies

```bash
npx ts-test-runner --headless --browser node
```

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
  "srcDir": "./projects/your-library/src/lib",
  "testDir": "./projects/your-library/src/tests", 
  "outDir": "./dist/.vite-jasmine-build",
  "tsconfig": "tsconfig.json",
  "port": 8888,
  "browser": "chrome",
  "headless": false,
  "htmlOptions": {
    "title": "your-project-name - Vite + Jasmine Tests"
  }
}
```

### Advanced Configuration

The configuration supports advanced options for different testing scenarios:

```json
{
  "srcDir": "./src",
  "testDir": "./tests",
  "outDir": "./dist/test-build",
  "tsconfig": "tsconfig.json",
  "port": 8888,
  "browser": "chrome",
  "headless": true,
  "viteConfig": {
    "define": {
      "process.env.NODE_ENV": "\"test\""
    }
  },
  "viteBuildOptions": {
    "target": "es2022",
    "sourcemap": true,
    "minify": false
  },
  "jasmineConfig": {
    "env": {
      "random": true,
      "stopSpecOnExpectationFailure": false,
      "timeout": 30000
    }
  },
  "htmlOptions": {
    "title": "My Project Tests"
  }
}
```

### Browser Options

| Browser | Command | Requirements |
|---------|---------|--------------|
| Chrome | `--browser chrome` | Playwright (automatic) |
| Firefox | `--browser firefox` | Playwright + Firefox binary |
| Safari | `--browser webkit` | Playwright + WebKit binary |
| Node.js | `--browser node` | None (built-in) |

### Custom Config File

Use a different config file:

```bash
npx ts-test-runner --config ./custom-config.json --headless
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

### Browser-Specific Tests

Test DOM interactions and browser APIs:

```typescript
describe('DOM Component', () => {
  it('should create and manipulate elements', () => {
    const div = document.createElement('div');
    div.innerHTML = '<p>Hello World</p>';
    document.body.appendChild(div);
    
    expect(document.querySelector('p')?.textContent).toBe('Hello World');
    
    // Cleanup
    document.body.removeChild(div);
  });

  it('should handle fetch API', async () => {
    // Mock or use real HTTP requests
    global.fetch = jasmine.createSpy().and.returnValue(
      Promise.resolve({
        json: () => Promise.resolve({ data: 'test' })
      })
    );

    // Your fetch-based code here
  });
});
```

## Features

- ✅ **Multiple Execution Modes**: Browser, headless browser, and Node.js
- ✅ **Playwright Integration**: Real browser testing with Chrome, Firefox, Safari
- ✅ **TypeScript Support**: Full TypeScript compilation with type checking
- ✅ **CI/CD Ready**: Headless mode perfect for automated pipelines
- ✅ **Source Maps**: Debug TypeScript directly in browser DevTools  
- ✅ **Project Name Detection**: Automatically uses your package.json name
- ✅ **Modern ES Modules**: ESM support with proper module resolution
- ✅ **WebSocket Communication**: Real-time test progress reporting
- ✅ **Auto Cleanup**: Automatic resource cleanup after test completion
- ✅ **Customizable**: Flexible configuration for different project structures

## CI/CD Integration

### GitHub Actions

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npx ts-test-runner --headless
```

### Multi-Browser Testing

```yaml
strategy:
  matrix:
    browser: [chrome, firefox, webkit]
steps:
  - run: npx ts-test-runner --headless --browser ${{ matrix.browser }}
```

### Node.js Only Testing (Fastest)

```yaml
steps:
  - run: npx ts-test-runner --headless --browser node
```

## Performance Comparison

| Mode | Speed | Browser APIs | Use Case |
|------|-------|-------------|----------|
| Node.js | Fastest | Limited | Unit tests, pure logic |
| Headless Chrome | Medium | Full | Integration tests, DOM testing |
| Headless Firefox | Medium | Full | Cross-browser compatibility |
| Browser (headed) | Slowest | Full | Development, debugging |

## Troubleshooting

### Playwright Installation

If headless browser tests fail:
```bash
# Install all browsers
npx playwright install

# Install specific browser
npx playwright install chrome
npx playwright install firefox
npx playwright install webkit
```

### Port Already in Use
If port 8888 is busy, change it in `ts-test-runner.json`:
```json
{
  "port": 3000
}
```

### Browser Not Found
If a browser isn't available, the runner will automatically fall back to Node.js mode:
```
⚠️ Browser "firefox" not available, falling back to Node.js mode
```

### TypeScript Compilation Errors
Make sure your `tsconfig.json` is properly configured for your project structure.

### Tests Not Found
Verify your test files:
- Are in the correct `testDir` location
- Have `.spec.ts` extension
- Export proper Jasmine test suites

### WebSocket Connection Issues
In headless mode, if WebSocket communication fails, tests will still run but progress reporting may be limited.

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

### Browser-Only Test
```typescript
describe('Local Storage', () => {
  it('stores and retrieves data', () => {
    localStorage.setItem('test', 'value');
    expect(localStorage.getItem('test')).toBe('value');
    localStorage.removeItem('test');
  });
});
```

### Cross-Environment Test
```typescript
describe('Environment Detection', () => {
  it('detects runtime environment', () => {
    if (typeof window !== 'undefined') {
      // Browser environment
      expect(window.location).toBeDefined();
    } else {
      // Node.js environment
      expect(process.version).toBeDefined();
    }
  });
});
```

## License

MIT © 2025
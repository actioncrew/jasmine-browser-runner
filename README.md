# TypeScript Test Runner

A simple, browser-based test runner for TypeScript projects using Jasmine. Run your TypeScript tests directly in the browser without complex configuration.

## What it does

This tool compiles your TypeScript test files and runs them in a real browser environment using Jasmine. Perfect for testing browser-specific code or when you want to see your tests run in an actual browser.

## Installation

```bash
npm install --save-dev @actioncrew/ts-test-runner jasmine-core
```

## Quick Start

**Run tests**: Starts a local server and opens your tests in a browser
   ```bash
   npx ts-test-runner
   ```
   Then visit http://localhost:8888 to see your test results

## Project Structure

The test runner expects this basic structure:

```
your-project/
├── src/           # Your TypeScript source files
├── tests/         # Your .spec.ts test files
└── ts-test-runner.json  # Configuration (created by init)
```

## Basic Configuration

The `ts-test-runner.json` file contains simple settings:

```json
{
  "srcDir": "./src",
  "testDir": "./tests",
  "outDir": "./dist",
  "port": 8888,
  "browser": "chrome"
}
```

## Why Use This?

- Test TypeScript code in real browser environments
- No complex bundler setup required
- Live reloading during development
- Works with modern TypeScript features
- Simple alternative to heavy test frameworks

## License

MIT © 2025
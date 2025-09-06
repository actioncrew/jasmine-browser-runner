# TypeScript Test Runner

A lightweight, browser-based test runner for Jasmine 5 with TypeScript and Vite. Run Jasmine specs in browsers, headless browsers, or CI pipelines without Webpack or other bundlers.

[Download TypeScript Test Runner](https://www.npmjs.com/package/@actioncrew/ts-test-runner)

## Features
- Simple setup for TypeScript and Jasmine 5
- Supports modern browsers, headless modes, and remote Selenium grids
- ES Module and top-level await support
- Watch mode for live reloading
- HTTPS/TLS support
- Configurable via `ts-test-runner.json`

## Installation

Install as a dev dependency:

```bash
npm install --save-dev typescript-test-runner jasmine-core
```

or

```bash
yarn add -D typescript-test-runner jasmine-core
```

## Getting Started

Initialize the test runner:

```bash
npx ts-test-runner init
```

This generates a default `ts-test-runner.json` configuration file.

## Running Tests

### Interactive Mode
Serve tests interactively for debugging:

```bash
npx ts-test-runner serve
```

Open [http://localhost:8888](http://localhost:8888) in your browser.

### Direct Execution
Run tests directly in a browser:

```bash
npx ts-test-runner run
```

By default, it uses Chrome. Override the browser in `ts-test-runner.json`:

```json
{
  "browser": "firefox"
}
```

Supported browsers: `chrome`, `headlessChrome`, `firefox`, `headlessFirefox`, `safari`, `MicrosoftEdge`.

## Configuration (`ts-test-runner.json`)

Example configuration:

```json
{
  "srcDir": "./src",
  "testDir": "./tests",
  "outDir": ".vite-jasmine-build",
  "watch": true,
  "port": 8888,
  "browser": "chrome",
  "viteConfig": {},
  "jasmineConfig": {
    "random": true,
    "seed": null
  }
}
```

### Options
- `srcDir`: Directory with TypeScript source files
- `testDir`: Directory with `.spec.ts` files
- `outDir`: Output directory for compiled `.js` files
- `watch`: Rebuild on file changes (boolean)
- `port`: HTTP port for the test server
- `browser`: Browser to launch
- `viteConfig`: Additional Vite build options
- `jasmineConfig`: Jasmine environment configuration ([see Jasmine docs](https://jasmine.github.io))

## ES Module Support

The runner supports ES modules with the following features:

- `.mjs` or `.ts` files as modules
- Import maps via `importMap` configuration:

```json
{
  "importMap": {
    "moduleRootDir": "node_modules",
    "imports": {
      "rxjs": "rxjs/dist/esm5/index.js"
    }
  }
}
```

- Top-level await: Enable with `"enableTopLevelAwait": true`
- Source files with side effects: Enable with `"modulesWithSideEffectsInSrcFiles": true`

## Watch Mode

Automatically rebuild and reload tests on file changes:

```bash
npx ts-test-runner --watch
```

## HTTPS/TLS

Serve tests over HTTPS:

```json
{
  "tlsKey": "/path/to/key.pem",
  "tlsCert": "/path/to/cert.pem"
}
```

Note: Browsers may require flags for self-signed certificates.

## Remote Browser Grids

Run tests on remote Selenium grids (e.g., Sauce Labs, BrowserStack):

```json
{
  "browser": {
    "name": "chrome",
    "useRemoteSeleniumGrid": true,
    "remoteSeleniumGrid": {
      "url": "https://hub-cloud.browserstack.com/wd/hub",
      "bstack:options": {
        "browserVersion": "114",
        "os": "Windows",
        "osVersion": "10",
        "local": "true",
        "userName": "YOUR_USERNAME",
        "accessKey": "YOUR_ACCESS_KEY"
      }
    }
  }
}
```

Set `useRemoteSeleniumGrid` to `true` to enable.

## CLI Options

```bash
npx ts-test-runner [options]
```

| Option       | Description                  | Default                  |
|--------------|------------------------------|--------------------------|
| `-s, --src`  | Source directory             | `./src`                  |
| `-t, --tests`| Test directory               | `./tests`                |
| `-o, --out`  | Output directory             | `.vite-jasmine-build`    |
| `-p, --port` | Server port                  | `8888`                   |
| `-w, --watch`| Watch files                  | `false`                  |
| `--browser`  | Browser name                 | `chrome`                 |
| `--help`     | Show help                    |                          |

## Supported Environments

| Environment | Versions        |
|-------------|-----------------|
| Node        | 18+, 20, 22, 24 |
| Chrome      | Evergreen       |
| Firefox     | Evergreen       |
| Safari      | 15+             |
| Edge        | Evergreen       |

## Usage in Rails or Webpack Projects

1. Add `typescript-test-runner` and `jasmine-core` to dev dependencies.
2. Configure `srcDir` and `testDir` to point to compiled assets.
3. Run `npx ts-test-runner` and visit [http://localhost:8888](http://localhost:8888).

## License

MIT © 2025
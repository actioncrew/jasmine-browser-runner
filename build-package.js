import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mainPackage = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')
);

const distPackage = {
  name: mainPackage.name,
  version: mainPackage.version,
  description: mainPackage.description,
  bin: {
    "ts-test-runner": "bin/ts-test-runner"
  },
  files: [
    'README.md',
    'LICENSE',
    'package.json',
    'bin/',
    'lib/',
    'vendor/'
  ],
  keywords: mainPackage.keywords || [],
  author: mainPackage.author,
  license: mainPackage.license,
  dependencies: mainPackage.dependencies || {},
  peerDependencies: mainPackage.peerDependencies || {}
};

fs.writeFileSync(
  path.join(__dirname, 'dist/ts-test-runner/package.json'),
  JSON.stringify(distPackage, null, 2)
);

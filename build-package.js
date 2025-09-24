const fs = require('fs');
const path = require('path');

const mainPackage = JSON.parse(fs.readFileSync('package.json', 'utf8'));

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
    'bin/'
  ],
  keywords: mainPackage.keywords || [],
  author: mainPackage.author,
  license: mainPackage.license,
  dependencies: mainPackage.dependencies || {},
  peerDependencies: mainPackage.peerDependencies || {}
};

fs.writeFileSync(
  path.join('dist/ts-test-runner/', 'package.json'),
  JSON.stringify(distPackage, null, 2)
);

const { readFileSync } = require('node:fs');
const path = require('node:path');

const packageJsonPath = path.resolve(__dirname, '..', '..', 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const tag = process.env.GITHUB_REF_NAME;

if (!tag) {
  console.error('GITHUB_REF_NAME is required to verify a release tag.');
  process.exit(1);
}

const expectedTag = `v${packageJson.version}`;
if (tag !== expectedTag) {
  if (!tag.startsWith('v')) {
    console.error(`Release tag must be ${expectedTag}; received ${tag}.`);
  } else {
    console.error(`Release tag ${tag} does not match package version ${packageJson.version}.`);
  }
  process.exit(1);
}

console.log(`Verified release tag ${tag}.`);


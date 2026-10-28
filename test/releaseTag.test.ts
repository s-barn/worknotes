import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const repositoryRoot = path.resolve(__dirname, '../..');
const verifier = path.join(repositoryRoot, '.github', 'scripts', 'verify-release-tag.js');
const packageVersion = JSON.parse(readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8')).version as string;
const expectedTag = `v${packageVersion}`;

function verify(tag?: string) {
  const environment = { ...process.env };
  if (tag === undefined) {
    delete environment.GITHUB_REF_NAME;
  } else {
    environment.GITHUB_REF_NAME = tag;
  }

  return spawnSync(process.execPath, [verifier], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: environment
  });
}

test('release tag verifier accepts the package version with a v prefix', () => {
  const result = verify(expectedTag);

  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes(`Verified release tag ${expectedTag}`));
});

test('release tag verifier rejects a version that differs from package.json', () => {
  const result = verify('v999.999.999');

  assert.notEqual(result.status, 0);
  assert.ok(result.stderr.includes(`does not match package version ${packageVersion}`));
});

test('release tag verifier rejects a tag without the v prefix', () => {
  const result = verify(packageVersion);

  assert.notEqual(result.status, 0);
  assert.ok(result.stderr.includes(`must be ${expectedTag}`));
});

test('release tag verifier rejects a missing GitHub tag', () => {
  const result = verify();

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /GITHUB_REF_NAME is required/);
});


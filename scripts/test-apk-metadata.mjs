#!/usr/bin/env node
/**
 * Build-time APK metadata regression tests.
 *
 * These use tiny synthetic APKs (real ZIP containers with binary Android XML)
 * so version changes, size changes, compression/encoding variants, missing
 * files and unreadable manifests are all exercised without shipping a second
 * 8 MB binary. Run with `npm test`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GENERATOR = join(ROOT, 'scripts', 'generate-apk-metadata.mjs');
const FIXTURE_TOOL = join(ROOT, 'scripts', 'make-test-apk.py');
const LEGACY_MANIFEST = join(ROOT, 'data', 'release.json');
const FIXTURE_ENV = {
  ...process.env,
  // Deterministic fallback date when apk/release.json has none. 2026-01-01 UTC.
  SOURCE_DATE_EPOCH: '1767225600',
  VERCEL_GIT_COMMIT_DATE: '',
};

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function formatSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

function makeFixture(t, options = {}) {
  const {
    releaseJson = JSON.stringify({
      releaseDate: '2026-12-01',
      whatsNew: ['Added new playable characters', 'Improved low-end Android performance'],
    }, null, 2),
    apk = true,
    omitManifest = false,
    utf8Strings = false,
    compression = 'deflate',
    version = '9.8.7',
    versionCode = 42,
    extraBytes = 1234,
    legacyAvailable = true,
  } = options;

  const dir = mkdtempSync(join(tmpdir(), 'scs-apk-metadata-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  mkdirSync(join(dir, 'apk'), { recursive: true });
  mkdirSync(join(dir, 'data'), { recursive: true });
  copyFileSync(GENERATOR, join(dir, 'scripts', 'generate-apk-metadata.mjs'));
  writeFileSync(
    join(dir, 'data', 'release.json'),
    `${JSON.stringify({ available: legacyAvailable, history: [], certSha256: 'abc' }, null, 2)}\n`,
  );
  if (releaseJson !== null) writeFileSync(join(dir, 'apk', 'release.json'), releaseJson);
  writeFileSync(join(dir, '.env'), 'PRIVATE_TEST_VALUE=must-not-be-deployed\n');

  if (apk) {
    execFileSync('python3', [
      FIXTURE_TOOL,
      '--output', join(dir, 'apk', 'SCS.apk'),
      '--version', version,
      '--version-code', String(versionCode),
      '--compression', compression,
      '--extra-bytes', String(extraBytes),
      ...(utf8Strings ? ['--utf8-strings'] : []),
      ...(omitManifest ? ['--omit-manifest'] : []),
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
  }
  return dir;
}

function runBuild(dir) {
  const stdout = execFileSync(process.execPath, [join(dir, 'scripts', 'generate-apk-metadata.mjs')], {
    cwd: dir,
    encoding: 'utf8',
    env: FIXTURE_ENV,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return { stdout, metadata: readJson(join(dir, 'data', 'apk-metadata.json')) };
}

function assertHealthyOutput(dir, metadata) {
  assert.equal(metadata.downloadUrl, '/apk/SCS.apk');
  assert.equal(metadata.fileName, 'SCS.apk');
  assert.equal(metadata.fileSizeBytes, statSync(join(dir, 'apk', 'SCS.apk')).size);
  assert.equal(metadata.fileSize, formatSize(metadata.fileSizeBytes));
  assert.equal(metadata.sha256, sha256(join(dir, 'apk', 'SCS.apk')));
  assert.match(metadata.releaseDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(readJson(join(dir, 'dist', 'data', 'apk-metadata.json')), metadata);
  assert.equal(sha256(join(dir, 'dist', 'apk', 'SCS.apk')), metadata.sha256);
  assert.equal(existsSync(join(dir, 'dist', '.env')), false, 'sensitive files must not be staged');

  const legacy = readJson(join(dir, 'data', 'release.json'));
  assert.equal(legacy.version, metadata.versionName);
  assert.equal(legacy.versionCode, metadata.versionCode === null ? '' : String(metadata.versionCode));
  assert.equal(legacy.fileSizeBytes, metadata.fileSizeBytes);
  assert.equal(legacy.sha256, metadata.sha256);
  assert.equal(legacy.downloadUrl, metadata.downloadUrl);
  assert.equal(legacy.releaseDate, metadata.releaseDate);
  assert.deepEqual(readJson(join(dir, 'dist', 'data', 'release.json')), legacy);
}

test('extracts a changed versionName, versionCode and actual size from a deflated UTF-16 APK', t => {
  const dir = makeFixture(t, { version: '9.8.7', versionCode: 42, extraBytes: 4321 });
  const { metadata } = runBuild(dir);
  assert.equal(metadata.available, true);
  assert.equal(metadata.status, 'ok');
  assert.equal(metadata.versionName, '9.8.7');
  assert.equal(metadata.versionCode, 42);
  assert.equal(metadata.packageName, 'com.example.scs');
  assert.equal(metadata.minSdkVersion, 24);
  assert.equal(metadata.targetSdkVersion, 36);
  assert.equal(metadata.releaseDate, '2026-12-01');
  assert.equal(metadata.releaseDateSource, 'apk/release.json');
  assert.equal(metadata.changelogAvailable, true);
  assert.equal(metadata.metadataError, null);
  assertHealthyOutput(dir, metadata);
});

test('supports stored ZIP entries and UTF-8 binary XML string pools', t => {
  const dir = makeFixture(t, {
    version: '7.6.5-rc1',
    versionCode: 99,
    compression: 'store',
    utf8Strings: true,
    extraBytes: 2048,
  });
  const { metadata } = runBuild(dir);
  assert.equal(metadata.status, 'ok');
  assert.equal(metadata.versionName, '7.6.5-rc1');
  assert.equal(metadata.versionCode, 99);
  assert.equal(metadata.packageName, 'com.example.scs');
  assertHealthyOutput(dir, metadata);
});

test('a missing APK produces unavailable metadata without failing the build', t => {
  const dir = makeFixture(t, { apk: false });
  const { metadata } = runBuild(dir);
  assert.equal(metadata.available, false);
  assert.equal(metadata.status, 'unavailable');
  assert.equal(metadata.versionName, null);
  assert.equal(metadata.versionCode, null);
  assert.equal(metadata.fileSizeBytes, null);
  assert.equal(metadata.downloadUrl, '/apk/SCS.apk');
  assert.match(metadata.metadataError, /missing/i);
  assert.equal(existsSync(join(dir, 'dist', 'apk', 'SCS.apk')), false);
  assert.deepEqual(readJson(join(dir, 'dist', 'data', 'apk-metadata.json')), metadata);
  // The human kill-switch is preserved; file availability lives in metadata.
  assert.equal(readJson(join(dir, 'data', 'release.json')).available, true);
});

test('an invalid or missing apk/release.json does not affect APK facts or the download', t => {
  for (const releaseJson of [null, '{ this is not JSON']) {
    const dir = makeFixture(t, { releaseJson });
    const { metadata } = runBuild(dir);
    assert.equal(metadata.available, true);
    assert.equal(metadata.status, 'ok');
    assert.equal(metadata.versionName, '9.8.7');
    assert.equal(metadata.changelogAvailable, false);
    assert.equal(metadata.releaseDate, '2026-01-01');
    assert.equal(metadata.releaseDateSource, 'build-environment');
    assert.equal(metadata.downloadUrl, '/apk/SCS.apk');
    assertHealthyOutput(dir, metadata);
  }
});

test('an unreadable Android manifest keeps the direct APK download available', t => {
  const dir = makeFixture(t, { omitManifest: true });
  const { metadata } = runBuild(dir);
  assert.equal(metadata.available, true);
  assert.equal(metadata.status, 'partial');
  assert.equal(metadata.versionName, null);
  assert.equal(metadata.versionCode, null);
  assert.equal(metadata.fileSizeBytes, statSync(join(dir, 'apk', 'SCS.apk')).size);
  assert.match(metadata.metadataError, /AndroidManifest\.xml/i);
  assert.equal(metadata.downloadUrl, '/apk/SCS.apk');
  assertHealthyOutput(dir, metadata);
});

test('a manual kill-switch remains false after generated metadata is refreshed', t => {
  const dir = makeFixture(t, { legacyAvailable: false });
  const { metadata } = runBuild(dir);
  assert.equal(metadata.available, true);
  assert.equal(readJson(join(dir, 'data', 'release.json')).available, false);
});

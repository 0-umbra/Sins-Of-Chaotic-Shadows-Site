#!/usr/bin/env node
/**
 * Build-time APK metadata generator for the SCS static site.
 *
 * Vercel runs `npm run build` (see vercel.json). This script:
 *   1. reads apk/SCS.apk directly, including its binary AndroidManifest.xml;
 *   2. measures the real byte size and SHA-256;
 *   3. reads the human-written release date / changelog from apk/release.json;
 *   4. writes data/apk-metadata.json and refreshes the legacy data/release.json;
 *   5. stages the unchanged static site in dist/, which Vercel serves.
 *
 * It has no npm dependencies and needs neither aapt nor Java. A missing APK or
 * unreadable manifest produces an honest fallback metadata file instead of
 * failing the deployment. Version name, version code and size are never read
 * from a hand-maintained website field.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APK = join(ROOT, 'apk', 'SCS.apk');
const RELEASE_NOTES = join(ROOT, 'apk', 'release.json');
const METADATA = join(ROOT, 'data', 'apk-metadata.json');
const LEGACY_MANIFEST = join(ROOT, 'data', 'release.json');
const DIST = join(ROOT, 'dist');
const APK_URL = '/apk/SCS.apk';
const APK_NAME = 'SCS.apk';

// Android binary XML / resource value chunk constants.
const RES_STRING_POOL_TYPE = 0x0001;
const RES_XML_TYPE = 0x0003;
const RES_XML_START_ELEMENT_TYPE = 0x0102;
const TYPE_REFERENCE = 0x01;
const TYPE_STRING = 0x03;
const TYPE_INT_DEC = 0x10;
const TYPE_INT_HEX = 0x11;
const TYPE_INT_BOOLEAN = 0x12;
const UTF8_FLAG = 0x100;
const NO_ENTRY = 0xffffffff;

function warn(message) {
  console.warn(`[apk-metadata] ${message}`);
}

function info(message) {
  console.log(`[apk-metadata] ${message}`);
}

function relative(path) {
  return path.startsWith(ROOT) ? path.slice(ROOT.length + 1) : path;
}

function jsonSafe(path, fallback) {
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
  } catch (err) {
    warn(`${relative(path)} is missing or invalid (${err.message}); using a safe fallback.`);
    return fallback;
  }
}

function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

function validIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function dateFromApkGitHistory() {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cI', '--', 'apk/SCS.apk'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const date = out.slice(0, 10);
    return validIsoDate(date) ? date : null;
  } catch {
    return null;
  }
}

function fallbackDate() {
  for (const candidate of [
    process.env.VERCEL_GIT_COMMIT_DATE?.slice(0, 10),
    process.env.SOURCE_DATE_EPOCH
      ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString().slice(0, 10)
      : null,
  ]) {
    if (validIsoDate(candidate)) return { date: candidate, source: 'build-environment' };
  }
  return { date: new Date().toISOString().slice(0, 10), source: 'build-date' };
}

function resolveReleaseDate(notes) {
  if (validIsoDate(notes.releaseDate)) {
    return { date: notes.releaseDate, source: 'apk/release.json' };
  }
  const gitDate = dateFromApkGitHistory();
  if (gitDate) return { date: gitDate, source: 'git-commit-of-apk' };
  return fallbackDate();
}

function cleanManifestText(value, maxLength = 160) {
  if (typeof value !== 'string') return null;
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, maxLength);
  return clean || null;
}

function findEndOfCentralDirectory(zip) {
  if (zip.length < 22) throw new Error('APK is too small to be a ZIP archive.');
  const lowest = Math.max(0, zip.length - 22 - 0xffff);
  for (let pos = zip.length - 22; pos >= lowest; pos -= 1) {
    if (zip.readUInt32LE(pos) !== 0x06054b50) continue;
    const commentLength = zip.readUInt16LE(pos + 20);
    if (pos + 22 + commentLength === zip.length) return pos;
  }
  throw new Error('ZIP end-of-central-directory record not found.');
}

/** Read one central-directory ZIP entry with Node built-ins only. */
function readZipEntry(zip, wantedName) {
  const eocd = findEndOfCentralDirectory(zip);
  const entryCount = zip.readUInt16LE(eocd + 10);
  let pos = zip.readUInt32LE(eocd + 16);

  for (let i = 0; i < entryCount; i += 1) {
    if (pos + 46 > zip.length || zip.readUInt32LE(pos) !== 0x02014b50) {
      throw new Error('ZIP central directory is malformed.');
    }
    const method = zip.readUInt16LE(pos + 10);
    let compressedSize = zip.readUInt32LE(pos + 20);
    const nameLength = zip.readUInt16LE(pos + 28);
    const extraLength = zip.readUInt16LE(pos + 30);
    const commentLength = zip.readUInt16LE(pos + 32);
    let localHeaderOffset = zip.readUInt32LE(pos + 42);
    const nameStart = pos + 46;
    const name = zip.toString('utf8', nameStart, nameStart + nameLength);
    const extraStart = nameStart + nameLength;

    // ZIP64 is uncommon for APKs, but parse its extra field when a 32-bit
    // size/offset is saturated so larger future builds keep working.
    if (compressedSize === NO_ENTRY || localHeaderOffset === NO_ENTRY) {
      let p = extraStart;
      const end = extraStart + extraLength;
      while (p + 4 <= end) {
        const id = zip.readUInt16LE(p);
        const size = zip.readUInt16LE(p + 2);
        if (id === 0x0001 && p + 4 + size <= zip.length) {
          let q = p + 4;
          if (compressedSize === NO_ENTRY && q + 16 <= p + 4 + size) {
            q += 8; // uncompressed size precedes compressed size.
            compressedSize = Number(zip.readBigUInt64LE(q));
            q += 8;
          }
          if (localHeaderOffset === NO_ENTRY && q + 8 <= p + 4 + size) {
            localHeaderOffset = Number(zip.readBigUInt64LE(q));
          }
          break;
        }
        p += 4 + size;
      }
    }

    if (name === wantedName) {
      if (localHeaderOffset === NO_ENTRY || localHeaderOffset + 30 > zip.length ||
          zip.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
        throw new Error(`Local ZIP header for ${wantedName} is missing.`);
      }
      const localNameLength = zip.readUInt16LE(localHeaderOffset + 26);
      const localExtraLength = zip.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
      const compressed = zip.subarray(dataStart, dataStart + compressedSize);
      if (compressed.length !== compressedSize) throw new Error(`Truncated ZIP entry: ${wantedName}.`);
      if (method === 0) return compressed;
      if (method === 8) return inflateRawSync(compressed);
      throw new Error(`Unsupported ZIP compression method ${method} for ${wantedName}.`);
    }
    pos += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error(`APK does not contain ${wantedName}.`);
}

function parseStringPool(xml, offset, headerSize, chunkSize) {
  if (headerSize < 28) throw new Error('Binary XML string pool header is too small.');
  const stringCount = xml.readUInt32LE(offset + 8);
  const flags = xml.readUInt32LE(offset + 16);
  const stringsStart = xml.readUInt32LE(offset + 20);
  const offsetsStart = offset + headerSize;
  const dataStart = offset + stringsStart;
  const chunkEnd = offset + chunkSize;
  if (dataStart > chunkEnd || offsetsStart + stringCount * 4 > chunkEnd) {
    throw new Error('Binary XML string pool is out of bounds.');
  }
  const utf8 = (flags & UTF8_FLAG) !== 0;
  const strings = new Array(stringCount);

  for (let i = 0; i < stringCount; i += 1) {
    let p = dataStart + xml.readUInt32LE(offsetsStart + i * 4);
    if (p >= chunkEnd) throw new Error('Binary XML string offset is out of bounds.');
    if (utf8) {
      const readLength = () => {
        if (p >= chunkEnd) throw new Error('Truncated UTF-8 binary XML string.');
        let length = xml[p];
        p += 1;
        if (length & 0x80) {
          if (p >= chunkEnd) throw new Error('Truncated UTF-8 binary XML string length.');
          length = ((length & 0x7f) << 8) | xml[p];
          p += 1;
        }
        return length;
      };
      readLength(); // length in UTF-16 code units; byte length follows.
      const byteLength = readLength();
      if (p + byteLength > chunkEnd) throw new Error('UTF-8 binary XML string is out of bounds.');
      strings[i] = xml.toString('utf8', p, p + byteLength);
    } else {
      if (p + 2 > chunkEnd) throw new Error('Truncated UTF-16 binary XML string.');
      let length = xml.readUInt16LE(p);
      p += 2;
      if (length & 0x8000) {
        if (p + 2 > chunkEnd) throw new Error('Truncated UTF-16 binary XML string length.');
        length = ((length & 0x7fff) << 16) | xml.readUInt16LE(p);
        p += 2;
      }
      const byteLength = length * 2;
      if (p + byteLength > chunkEnd) throw new Error('UTF-16 binary XML string is out of bounds.');
      strings[i] = xml.toString('utf16le', p, p + byteLength);
    }
  }
  return strings;
}

function attributeValue(xml, attrOffset, strings) {
  const rawValue = xml.readUInt32LE(attrOffset + 8);
  const dataType = xml.readUInt8(attrOffset + 15);
  const data = xml.readUInt32LE(attrOffset + 16);
  // A literal rawValue is the most direct representation when one exists.
  if (rawValue !== NO_ENTRY && typeof strings[rawValue] === 'string') return strings[rawValue];
  if (dataType === TYPE_STRING) return typeof strings[data] === 'string' ? strings[data] : null;
  if (dataType === TYPE_INT_DEC || dataType === TYPE_INT_HEX) return String(data);
  if (dataType === TYPE_INT_BOOLEAN) return data ? 'true' : 'false';
  if (dataType === TYPE_REFERENCE) return null; // resource references are not literal version names
  return null;
}

/** Extract literal manifest facts from an Android binary XML document. */
function parseBinaryManifest(xml) {
  if (xml.length < 8 || xml.readUInt16LE(0) !== RES_XML_TYPE) {
    throw new Error('AndroidManifest.xml is not binary XML.');
  }
  const documentSize = xml.readUInt32LE(4);
  const end = Math.min(xml.length, documentSize || xml.length);
  let pos = xml.readUInt16LE(2);
  let strings = [];
  const result = {
    versionName: null,
    versionCode: null,
    packageName: null,
    minSdkVersion: null,
    targetSdkVersion: null,
  };

  while (pos + 8 <= end) {
    const type = xml.readUInt16LE(pos);
    const headerSize = xml.readUInt16LE(pos + 2);
    const chunkSize = xml.readUInt32LE(pos + 4);
    if (chunkSize < headerSize || pos + chunkSize > end) {
      throw new Error('Malformed binary XML chunk.');
    }
    if (type === RES_STRING_POOL_TYPE) {
      strings = parseStringPool(xml, pos, headerSize, chunkSize);
    } else if (type === RES_XML_START_ELEMENT_TYPE) {
      const attributesStart = pos + headerSize;
      if (attributesStart + 20 <= pos + chunkSize) {
        const tag = strings[xml.readUInt32LE(attributesStart + 4)] || '';
        const attrOffset = xml.readUInt16LE(attributesStart + 8);
        const attrSize = xml.readUInt16LE(attributesStart + 10);
        const attrCount = xml.readUInt16LE(attributesStart + 12);
        for (let i = 0; i < attrCount; i += 1) {
          const p = attributesStart + attrOffset + i * attrSize;
          if (p + 20 > pos + chunkSize) break;
          const name = strings[xml.readUInt32LE(p + 4)] || '';
          const value = cleanManifestText(attributeValue(xml, p, strings));
          if (!value) continue;
          if (tag === 'manifest') {
            if (name === 'versionName') result.versionName = value;
            else if (name === 'versionCode' && /^\d+$/.test(value)) result.versionCode = Number(value);
            else if (name === 'package' && /^[A-Za-z_][A-Za-z0-9_.]*$/.test(value)) result.packageName = value;
          } else if (tag === 'uses-sdk') {
            if (name === 'minSdkVersion' && /^\d+$/.test(value)) result.minSdkVersion = Number(value);
            else if (name === 'targetSdkVersion' && /^\d+$/.test(value)) result.targetSdkVersion = Number(value);
          }
        }
      }
    }
    pos += chunkSize;
  }
  return result;
}

function inspectApk(bytes) {
  const manifestXml = readZipEntry(bytes, 'AndroidManifest.xml');
  const facts = parseBinaryManifest(manifestXml);
  const missing = [];
  if (!facts.versionName) missing.push('versionName');
  if (facts.versionCode === null) missing.push('versionCode');
  if (!facts.packageName) missing.push('package name');
  return { ...facts, missing };
}

function buildMetadata() {
  const notes = jsonSafe(RELEASE_NOTES, {});
  const notesItems = Array.isArray(notes.whatsNew)
    ? notes.whatsNew.filter(item => typeof item === 'string' && item.trim())
    : [];
  const { date, source } = resolveReleaseDate(notes);
  const base = {
    schemaVersion: 1,
    source: 'apk/SCS.apk',
    available: false,
    status: 'unavailable',
    versionName: null,
    versionCode: null,
    fileSize: '—',
    fileSizeBytes: null,
    releaseDate: date,
    releaseDateSource: source,
    downloadUrl: APK_URL,
    fileName: APK_NAME,
    sha256: null,
    packageName: null,
    minSdkVersion: null,
    targetSdkVersion: null,
    changelogAvailable: notesItems.length > 0,
    metadataError: null,
  };

  if (!existsSync(APK)) {
    return {
      ...base,
      metadataError: 'apk/SCS.apk is missing from this build.',
    };
  }

  const bytes = readFileSync(APK);
  const size = statSync(APK).size;
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  let manifest = null;
  let metadataError = null;
  try {
    manifest = inspectApk(bytes);
    if (manifest.missing.length) {
      metadataError = `Some APK manifest fields could not be read: ${manifest.missing.join(', ')}.`;
    }
  } catch (err) {
    metadataError = err instanceof Error ? err.message : String(err);
    warn(`APK metadata extraction failed (${metadataError}); the direct download remains available.`);
  }

  return {
    ...base,
    available: true,
    status: metadataError ? 'partial' : 'ok',
    versionName: manifest?.versionName || null,
    versionCode: manifest?.versionCode ?? null,
    fileSize: formatSize(size),
    fileSizeBytes: size,
    sha256,
    packageName: manifest?.packageName || null,
    minSdkVersion: manifest?.minSdkVersion ?? null,
    targetSdkVersion: manifest?.targetSdkVersion ?? null,
    metadataError,
  };
}

function writeLegacyManifest(metadata) {
  const config = jsonSafe(LEGACY_MANIFEST, { available: true, history: [], certSha256: '' });
  const legacy = {
    ...config,
    // `available` remains a human-controlled kill-switch; file availability comes
    // from the generated metadata. These fields are generated, never hand-edited.
    available: config.available !== false,
    version: metadata.versionName,
    versionCode: metadata.versionCode === null ? '' : String(metadata.versionCode),
    releaseDate: metadata.releaseDate,
    fileName: metadata.fileName,
    fileSizeBytes: metadata.fileSizeBytes,
    sha256: metadata.sha256,
    packageName: metadata.packageName,
    downloadUrl: metadata.downloadUrl,
    updated: metadata.releaseDate,
    note: typeof config.note === 'string' ? config.note : '',
    history: Array.isArray(config.history) ? config.history : [],
    certSha256: typeof config.certSha256 === 'string' ? config.certSha256 : '',
  };
  writeFileSync(LEGACY_MANIFEST, `${JSON.stringify(legacy, null, 2)}\n`, 'utf8');
}

const EXCLUDED_NAMES = new Set([
  '.git', '.vercel', '.arena', '.cache', '.output', '.next', '.nuxt',
  'node_modules', 'dist', 'coverage', '__pycache__', '.pytest_cache',
  '.DS_Store', 'Thumbs.db',
]);
const SENSITIVE_PATTERNS = [
  /^\.env(?:\.|$)/i,
  /^\.git(?:config|credentials|-credentials)$/i,
  /^\.netrc$/i,
  /^\.npmrc$/i,
  /\.(?:pem|key|jks|keystore|p12|pfx)$/i,
];

function safeToCopy(name) {
  return !EXCLUDED_NAMES.has(name) && !SENSITIVE_PATTERNS.some(pattern => pattern.test(name));
}

function stageStaticOutput() {
  rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST, { recursive: true });
  const filter = source => safeToCopy(basename(source));
  for (const entry of readdirSync(ROOT, { withFileTypes: true })) {
    if (!safeToCopy(entry.name) || entry.isSymbolicLink()) continue;
    const source = join(ROOT, entry.name);
    const target = join(DIST, entry.name);
    if (entry.isDirectory()) cpSync(source, target, { recursive: true, filter, dereference: false });
    else if (entry.isFile()) copyFileSync(source, target);
  }
  // Guarantee the generated facts are in the deployed output even if a source
  // copy filter ever changes.
  mkdirSync(join(DIST, 'data'), { recursive: true });
  copyFileSync(METADATA, join(DIST, 'data', 'apk-metadata.json'));
  copyFileSync(LEGACY_MANIFEST, join(DIST, 'data', 'release.json'));
}

function writeOutputs(metadata) {
  mkdirSync(dirname(METADATA), { recursive: true });
  writeFileSync(METADATA, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
  writeLegacyManifest(metadata);
  stageStaticOutput();
}

function main() {
  const metadata = buildMetadata();
  writeOutputs(metadata);
  if (metadata.available) {
    info(
      `${APK_NAME}: v${metadata.versionName || '?'} (code ${metadata.versionCode ?? '?'}), ` +
      `${metadata.fileSizeBytes?.toLocaleString() || '?'} bytes (${metadata.fileSize}), ` +
      `sha256=${metadata.sha256 || '?'}, status=${metadata.status}.`
    );
  } else {
    warn(`${metadata.metadataError} Wrote unavailable metadata; the site will show a safe fallback.`);
  }
  info(`Generated data/apk-metadata.json and staged dist/ for Vercel.`);
}

try {
  main();
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  warn(`Unexpected generator failure (${message}). Writing a safe fallback.`);
  const fallback = {
    schemaVersion: 1,
    source: 'apk/SCS.apk',
    available: existsSync(APK),
    status: 'partial',
    versionName: null,
    versionCode: null,
    fileSize: '—',
    fileSizeBytes: null,
    releaseDate: new Date().toISOString().slice(0, 10),
    releaseDateSource: 'build-date',
    downloadUrl: APK_URL,
    fileName: APK_NAME,
    sha256: null,
    packageName: null,
    minSdkVersion: null,
    targetSdkVersion: null,
    changelogAvailable: false,
    metadataError: 'APK metadata could not be generated.',
  };
  try {
    writeOutputs(fallback);
  } catch (outputError) {
    console.error('[apk-metadata] Could not write build output:', outputError);
    process.exitCode = 1;
  }
}

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// idkit — Zero-dependency ID generation library
// UUID v4, UUID v7, ULID, NanoID, Snowflake, Cuid2
// ─────────────────────────────────────────────────────────────────────────────

const { createHash, randomBytes, randomInt } = require('crypto');

// ── UUID v4 ──────────────────────────────────────────────────────────────────

/**
 * Generate a RFC 4122 version 4 UUID using crypto.randomBytes.
 * @returns {string} e.g. "f47ac10b-58cc-4372-a567-0e02b2c3d479"
 */
function uuidv4() {
  const b = randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // variant 1
  const h = b.toString('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

// ── UUID v7 (draft-ietf-uuidrev-rfc4122bis) ──────────────────────────────────

/**
 * Generate a RFC 9562 version 7 UUID (time-ordered).
 * First 48 bits = Unix ms timestamp, then 12 random bits, then 62 random bits.
 * @param {number} [timestamp=Date.now()] - Unix ms timestamp
 * @returns {string} e.g. "018f6a1c-5e1b-7c2a-9d4f-1a2b3c4d5e6f"
 */
function uuidv7(timestamp = Date.now()) {
  const b = randomBytes(16);
  // 48-bit timestamp into bytes 0-5
  b[0] = (timestamp / 0x10000000000) & 0xff;
  b[1] = (timestamp / 0x100000000) & 0xff;
  b[2] = (timestamp >>> 24) & 0xff;
  b[3] = (timestamp >>> 16) & 0xff;
  b[4] = (timestamp >>> 8) & 0xff;
  b[5] = timestamp & 0xff;
  // version 7 in the upper nibble of byte 6, lower nibble from random
  b[6] = (b[6] & 0x0f) | 0x70;
  // variant 1 in byte 8
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

/**
 * Extract the timestamp from a UUID v7.
 * @param {string} uuid
 * @returns {number|null} Unix ms timestamp, or null if not a v7 UUID
 */
function uuidv7Timestamp(uuid) {
  const clean = uuid.replace(/-/g, '');
  if (clean.length !== 32) return null;
  if (clean[12] !== '7') return null;
  const tsHex = clean.slice(0, 12);
  return parseInt(tsHex, 16);
}

// ── ULID ─────────────────────────────────────────────────────────────────────

const ULID_ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford Base32
const ULID_TIME_LEN = 10;
const ULID_RAND_LEN = 16;

/**
 * Generate a ULID (Universally Unique Lexicographically Sortable Identifier).
 * 26 chars: 10 char timestamp (Crockford Base32) + 16 char random.
 * @param {number} [timestamp=Date.now()] - Unix ms timestamp
 * @returns {string} e.g. "01ARZ3NDEKTSV4RRFFQ69G5FAV"
 */
function ulid(timestamp = Date.now()) {
  return _encodeTime(timestamp, ULID_TIME_LEN) + _encodeRandom(ULID_RAND_LEN);
}

function _encodeTime(ts, len) {
  let str = '';
  for (let i = len - 1; i >= 0; i--) {
    const mod = ULID_ENCODING[ts % 32];
    str = mod + str;
    ts = Math.floor(ts / 32);
  }
  return str;
}

function _encodeRandom(len) {
  const bytes = randomBytes(len);
  let str = '';
  for (let i = 0; i < len; i++) {
    str += ULID_ENCODING[bytes[i] % 32];
  }
  return str;
}

/**
 * Extract the timestamp from a ULID.
 * @param {string} id
 * @returns {number|null} Unix ms timestamp, or null if invalid
 */
function ulidTimestamp(id) {
  if (id.length !== 26) return null;
  let ts = 0;
  for (let i = 0; i < ULID_TIME_LEN; i++) {
    const char = id[i].toUpperCase();
    const idx = ULID_ENCODING.indexOf(char);
    if (idx === -1) return null;
    ts = ts * 32 + idx;
  }
  return ts;
}

// ── NanoID ───────────────────────────────────────────────────────────────────

const NANO_DEFAULT_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const NANO_DEFAULT_SIZE = 21;

/**
 * Generate a NanoID-style compact, URL-safe unique string.
 * @param {Object} [opts]
 * @param {number} [opts.size=21] - Length of the ID
 * @param {string} [opts.alphabet] - Custom alphabet (must be ≤ 256 chars)
 * @returns {string}
 */
function nanoid(opts = {}) {
  const size = opts.size || NANO_DEFAULT_SIZE;
  const alphabet = opts.alphabet ?? NANO_DEFAULT_ALPHABET;
  if (!alphabet || alphabet.length === 0) throw new Error('alphabet must not be empty');
  if (alphabet.length > 256) throw new Error('alphabet must not exceed 256 chars');

  const mask = (2 ** Math.ceil(Math.log2(alphabet.length))) - 1;
  const bytes = randomBytes(size * 2); // extra to avoid bias from modulo
  let id = '';
  let i = 0;
  while (id.length < size) {
    if (i >= bytes.length) {
      // extremely unlikely, but guard anyway
      return nanoid(opts);
    }
    const idx = bytes[i] & mask;
    if (idx < alphabet.length) {
      id += alphabet[idx];
    }
    i++;
  }
  return id;
}

/**
 * Generate a NanoID from a custom alphabet (convenience wrapper).
 * @param {string} alphabet
 * @param {number} [size=21]
 * @returns {string}
 */
function nanoidCustom(alphabet, size = NANO_DEFAULT_SIZE) {
  return nanoid({ alphabet, size });
}

// ── Snowflake (Twitter-style distributed ID) ─────────────────────────────────

/**
 * Create a Snowflake ID generator.
 *
 * 64-bit ID: [1 bit sign][41 bits timestamp][10 bits machine][12 bits sequence]
 *
 * @param {Object} opts
 * @param {number} [opts.epoch] - Custom epoch (ms). Default: Twitter epoch 1288834974657.
 * @param {number} [opts.machineId=0] - Machine/worker ID (0–1023).
 * @param {number} [opts.machineIdBits=10] - Bits for machine ID.
 * @param {number} [opts.sequenceBits=12] - Bits for sequence number.
 */
function createSnowflake(opts = {}) {
  const epoch = opts.epoch || 1288834974657;
  const machineId = opts.machineId ?? 0;
  const machineIdBits = opts.machineIdBits ?? 10;
  const sequenceBits = opts.sequenceBits ?? 12;

  const maxMachineId = (1 << machineIdBits) - 1;
  const maxSequence = (1 << sequenceBits) - 1;
  const machineShift = sequenceBits;
  const timestampShift = machineIdBits + sequenceBits;

  if (machineId < 0 || machineId > maxMachineId) {
    throw new Error(`machineId must be 0–${maxMachineId}`);
  }

  let lastTimestamp = -1;
  let sequence = 0;

  /**
   * Generate the next Snowflake ID.
   * @returns {string} 64-bit ID as string (may exceed Number.MAX_SAFE_INTEGER)
   */
  function next() {
    let now = Date.now();
    if (now < lastTimestamp) {
      // Clock moved backward — wait until it catches up
      now = lastTimestamp;
    }
    if (now === lastTimestamp) {
      sequence = (sequence + 1) & maxSequence;
      if (sequence === 0) {
        // Sequence exhausted in this ms — spin until next ms
        while (Date.now() <= lastTimestamp) { /* spin */ }
        now = Date.now();
      }
    } else {
      sequence = 0;
    }
    lastTimestamp = now;

    const ts = now - epoch;
    // Use BigInt to avoid overflow
    const id = (BigInt(ts) << BigInt(timestampShift))
      | (BigInt(machineId) << BigInt(machineShift))
      | BigInt(sequence);
    return id.toString();
  }

  return { next, epoch, machineId };
}

/**
 * Decode a Snowflake ID into its components.
 * @param {string} id - Snowflake ID string
 * @param {Object} [opts]
 * @param {number} [opts.epoch=1288834974657] - Custom epoch used during generation
 * @param {number} [opts.machineIdBits=10]
 * @param {number} [opts.sequenceBits=12]
 * @returns {{ timestamp: number, machineId: number, sequence: number }}
 */
function decodeSnowflake(id, opts = {}) {
  const epoch = opts.epoch || 1288834974657;
  const machineIdBits = opts.machineIdBits ?? 10;
  const sequenceBits = opts.sequenceBits ?? 12;

  const big = BigInt(id);
  const mask = (1n << BigInt(sequenceBits)) - 1n;
  const sequence = Number(big & mask);
  const machineId = Number((big >> BigInt(sequenceBits)) & ((1n << BigInt(machineIdBits)) - 1n));
  const tsDiff = Number(big >> BigInt(machineIdBits + sequenceBits));
  return {
    timestamp: tsDiff + epoch,
    machineId,
    sequence,
  };
}

// ── Cuid2 ────────────────────────────────────────────────────────────────────

const CUID2_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Generate a Cuid2-style collision-resistant ID.
 * Uses timestamp + counter + random + fingerprint for uniqueness.
 * @param {Object} [opts]
 * @param {number} [opts.size=24] - Length of the ID (min 4)
 * @returns {string}
 */
function cuid2(opts = {}) {
  const size = opts.size || 24;
  if (size < 4) throw new Error('size must be at least 4');

  // Base36 timestamp for sortability
  const ts = Date.now().toString(36);

  // Counter — uses random + process pid for entropy
  const counter = (process.pid * 0x1000 + randomInt(0, 0x10000)).toString(36).slice(-4);

  // Fingerprint — hostname hash + random
  const fingerprintSource = (require('os').hostname?.() || 'localhost') + ':' + randomInt(0, 0x10000);
  const fingerprintHash = createHash('sha256').update(fingerprintSource).digest();
  let fingerprint = '';
  for (let i = 0; i < 4; i++) {
    fingerprint += CUID2_ALPHABET[fingerprintHash[i] % 36];
  }

  // Random suffix to fill remaining length
  const prefix = ts + counter + fingerprint;
  const remaining = Math.max(2, size - prefix.length);
  const suffix = nanoid({ size: remaining, alphabet: CUID2_ALPHABET });

  return prefix + suffix;
}

// ── Utilities ────────────────────────────────────────────────────────────────

/**
 * Generate multiple IDs at once.
 * @param {Function} generator - ID generator function
 * @param {number} count - How many to generate
 * @returns {string[]}
 */
function batch(generator, count) {
  if (typeof generator !== 'function') throw new Error('generator must be a function');
  if (count < 0) throw new Error('count must be non-negative');
  return Array.from({ length: count }, () => generator());
}

/**
 * Validate that an ID matches a given format.
 * @param {string} id - The ID to validate
 * @param {'uuid'|'ulid'|'nanoid'} format - Format to check
 * @returns {boolean}
 */
function isValid(id, format) {
  if (typeof id !== 'string') return false;
  switch (format) {
    case 'uuid':
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
    case 'uuidv4':
      return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
    case 'uuidv7':
      return /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
    case 'ulid':
      return /^[0-9A-HJKMNP-TV-Z]{26}$/i.test(id);
    case 'nanoid':
      return /^[a-z0-9_-]{1,100}$/i.test(id) && id.length >= 4;
    default:
      return false;
  }
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  uuidv4,
  uuidv7,
  uuidv7Timestamp,
  ulid,
  ulidTimestamp,
  nanoid,
  nanoidCustom,
  createSnowflake,
  decodeSnowflake,
  cuid2,
  batch,
  isValid,
};

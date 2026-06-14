'use strict';

const assert = require('assert');
const {
  uuidv4, uuidv7, uuidv7Timestamp,
  ulid, ulidTimestamp,
  nanoid, nanoidCustom,
  createSnowflake, decodeSnowflake,
  cuid2, batch, isValid,
} = require('./index');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    failed++;
    console.error(`✗ ${name}: ${e.message}`);
  }
}

// ── UUID v4 ──────────────────────────────────────────────────────────────────

test('uuidv4: format', () => {
  const id = uuidv4();
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('uuidv4: unique', () => {
  const ids = new Set(Array.from({ length: 1000 }, () => uuidv4()));
  assert.strictEqual(ids.size, 1000);
});

test('uuidv4: version 4', () => {
  const id = uuidv4();
  assert.strictEqual(id[14], '4');
});

test('uuidv4: variant 1', () => {
  const id = uuidv4();
  const variant = id[19];
  assert.ok(['8', '9', 'a', 'b'].includes(variant));
});

// ── UUID v7 ──────────────────────────────────────────────────────────────────

test('uuidv7: format', () => {
  const id = uuidv7();
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('uuidv7: version 7', () => {
  const id = uuidv7();
  assert.strictEqual(id[14], '7');
});

test('uuidv7: timestamp extraction', () => {
  const ts = Date.now();
  const id = uuidv7(ts);
  const extracted = uuidv7Timestamp(id);
  assert.strictEqual(extracted, ts);
});

test('uuidv7: time-ordered', () => {
  const id1 = uuidv7(Date.now());
  // Small delay to ensure different timestamp
  const id2 = uuidv7(Date.now() + 1);
  assert.ok(id2 > id1, 'later uuidv7 should sort after earlier');
});

test('uuidv7: non-v7 returns null timestamp', () => {
  assert.strictEqual(uuidv7Timestamp(uuidv4()), null);
});

test('uuidv7: unique', () => {
  const ids = new Set(Array.from({ length: 1000 }, () => uuidv7()));
  assert.strictEqual(ids.size, 1000);
});

// ── ULID ─────────────────────────────────────────────────────────────────────

test('ulid: format', () => {
  const id = ulid();
  assert.match(id, /^[0-9A-HJKMNP-TV-Z]{26}$/);
});

test('ulid: no I/L/O/U', () => {
  const ids = Array.from({ length: 100 }, () => ulid()).join('');
  assert.ok(!/[ILOU]/.test(ids));
});

test('ulid: timestamp extraction', () => {
  const ts = Date.now();
  const id = ulid(ts);
  const extracted = ulidTimestamp(id);
  assert.strictEqual(extracted, ts);
});

test('ulid: sortable', () => {
  const ts1 = Date.now();
  const ts2 = ts1 + 1000;
  const id1 = ulid(ts1);
  const id2 = ulid(ts2);
  assert.ok(id2 > id1, 'later ulid should sort after earlier');
});

test('ulid: same ms differ in random', () => {
  const ts = Date.now();
  const ids = new Set(Array.from({ length: 100 }, () => ulid(ts)));
  assert.ok(ids.size > 95, 'should be almost all unique');
});

test('ulid: unique', () => {
  const ids = new Set(Array.from({ length: 1000 }, () => ulid()));
  assert.strictEqual(ids.size, 1000);
});

test('ulid: invalid returns null timestamp', () => {
  assert.strictEqual(ulidTimestamp('short'), null);
  assert.strictEqual(ulidTimestamp('I' + '0'.repeat(25)), null); // invalid char I
});

// ── NanoID ───────────────────────────────────────────────────────────────────

test('nanoid: default size', () => {
  const id = nanoid();
  assert.strictEqual(id.length, 21);
});

test('nanoid: custom size', () => {
  assert.strictEqual(nanoid({ size: 10 }).length, 10);
  assert.strictEqual(nanoid({ size: 32 }).length, 32);
});

test('nanoid: default alphabet', () => {
  const id = nanoid();
  assert.match(id, /^[a-z0-9]+$/);
});

test('nanoid: custom alphabet', () => {
  const id = nanoid({ alphabet: 'abc', size: 20 });
  assert.match(id, /^[abc]{20}$/);
});

test('nanoid: nanoidCustom wrapper', () => {
  const id = nanoidCustom('XYZ', 15);
  assert.match(id, /^[XYZ]{15}$/);
});

test('nanoid: unique', () => {
  const ids = new Set(Array.from({ length: 10000 }, () => nanoid()));
  assert.strictEqual(ids.size, 10000);
});

test('nanoid: empty alphabet throws', () => {
  assert.throws(() => nanoid({ alphabet: '' }), /alphabet must not be empty/);
});

test('nanoid: oversized alphabet throws', () => {
  assert.throws(() => nanoid({ alphabet: 'x'.repeat(257) }), /alphabet must not exceed 256/);
});

test('nanoid: URL-safe alphabet', () => {
  const id = nanoid({ alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_' });
  assert.ok(id.length === 21);
});

// ── Snowflake ────────────────────────────────────────────────────────────────

test('snowflake: generates string id', () => {
  const sf = createSnowflake({ machineId: 1 });
  const id = sf.next();
  assert.strictEqual(typeof id, 'string');
  assert.ok(id.length > 0);
});

test('snowflake: monotonic within same ms', () => {
  const sf = createSnowflake({ machineId: 0 });
  const id1 = BigInt(sf.next());
  const id2 = BigInt(sf.next());
  assert.ok(id2 > id1, 'second snowflake should be > first');
});

test('snowflake: different machine ids produce different ids', () => {
  const sf1 = createSnowflake({ machineId: 1 });
  const sf2 = createSnowflake({ machineId: 2 });
  const id1 = sf1.next();
  const id2 = sf2.next();
  assert.notStrictEqual(id1, id2);
});

test('snowflake: decode returns correct components', () => {
  const epoch = 1288834974657;
  const sf = createSnowflake({ machineId: 42, epoch });
  const id = sf.next();
  const decoded = decodeSnowflake(id, { epoch });
  assert.ok(decoded.timestamp > 0);
  assert.strictEqual(decoded.machineId, 42);
  assert.ok(decoded.sequence >= 0);
});

test('snowflake: decoded timestamp close to now', () => {
  const epoch = 1288834974657;
  const sf = createSnowflake({ machineId: 0, epoch });
  const before = Date.now();
  const id = sf.next();
  const after = Date.now();
  const decoded = decodeSnowflake(id, { epoch });
  assert.ok(decoded.timestamp >= before && decoded.timestamp <= after,
    `timestamp ${decoded.timestamp} should be in [${before}, ${after}]`);
});

test('snowflake: invalid machineId throws', () => {
  assert.throws(() => createSnowflake({ machineId: -1 }), /machineId/);
  assert.throws(() => createSnowflake({ machineId: 1024 }), /machineId/);
});

test('snowflake: custom bits', () => {
  const sf = createSnowflake({ machineId: 5, machineIdBits: 8, sequenceBits: 14, epoch: 1700000000000 });
  const id = sf.next();
  const decoded = decodeSnowflake(id, { machineIdBits: 8, sequenceBits: 14, epoch: 1700000000000 });
  assert.strictEqual(decoded.machineId, 5);
});

test('snowflake: unique', () => {
  const sf = createSnowflake({ machineId: 0 });
  const ids = new Set();
  for (let i = 0; i < 1000; i++) ids.add(sf.next());
  assert.strictEqual(ids.size, 1000);
});

// ── Cuid2 ────────────────────────────────────────────────────────────────────

test('cuid2: default size', () => {
  const id = cuid2();
  assert.ok(id.length >= 20, `length ${id.length} should be >= 20`);
});

test('cuid2: custom size', () => {
  const id = cuid2({ size: 32 });
  assert.strictEqual(id.length, 32);
});

test('cuid2: lowercase alphanumeric', () => {
  const id = cuid2();
  assert.match(id, /^[a-z0-9]+$/);
});

test('cuid2: starts with timestamp (sortable)', () => {
  const id1 = cuid2();
  const id2 = cuid2();
  // First char should be a base36 char (timestamp prefix)
  assert.match(id1[0], /^[0-9a-z]$/);
  assert.match(id2[0], /^[0-9a-z]$/);
});

test('cuid2: unique', () => {
  const ids = new Set(Array.from({ length: 1000 }, () => cuid2()));
  assert.strictEqual(ids.size, 1000);
});

test('cuid2: size too small throws', () => {
  assert.throws(() => cuid2({ size: 2 }), /size must be at least 4/);
});

// ── Batch ────────────────────────────────────────────────────────────────────

test('batch: generates N ids', () => {
  const ids = batch(uuidv4, 5);
  assert.strictEqual(ids.length, 5);
  assert.strictEqual(new Set(ids).size, 5);
});

test('batch: zero count', () => {
  assert.strictEqual(batch(uuidv4, 0).length, 0);
});

test('batch: throws on negative', () => {
  assert.throws(() => batch(uuidv4, -1), /non-negative/);
});

test('batch: throws on non-function', () => {
  assert.throws(() => batch('notfn', 5), /generator must be a function/);
});

test('batch: works with ulid', () => {
  const ids = batch(ulid, 10);
  assert.strictEqual(ids.length, 10);
  ids.forEach(id => assert.match(id, /^[0-9A-HJKMNP-TV-Z]{26}$/));
});

// ── isValid ──────────────────────────────────────────────────────────────────

test('isValid: uuid v4', () => {
  assert.ok(isValid(uuidv4(), 'uuid'));
  assert.ok(isValid(uuidv4(), 'uuidv4'));
  assert.ok(!isValid(uuidv4(), 'uuidv7'));
});

test('isValid: uuid v7', () => {
  assert.ok(isValid(uuidv7(), 'uuid'));
  assert.ok(isValid(uuidv7(), 'uuidv7'));
  assert.ok(!isValid(uuidv7(), 'uuidv4'));
});

test('isValid: ulid', () => {
  assert.ok(isValid(ulid(), 'ulid'));
  assert.ok(!isValid('short', 'ulid'));
});

test('isValid: nanoid', () => {
  assert.ok(isValid(nanoid(), 'nanoid'));
  assert.ok(!isValid('', 'nanoid'));
});

test('isValid: non-string returns false', () => {
  assert.ok(!isValid(123, 'uuid'));
  assert.ok(!isValid(null, 'uuid'));
});

test('isValid: unknown format returns false', () => {
  assert.ok(!isValid('abc', 'unknown'));
});

// ── Integration ──────────────────────────────────────────────────────────────

test('integration: generate all types', () => {
  const sf = createSnowflake({ machineId: 1 });
  const ids = {
    uuid4: uuidv4(),
    uuid7: uuidv7(),
    ulid: ulid(),
    nano: nanoid(),
    cuid: cuid2(),
    snowflake: sf.next(),
  };
  Object.entries(ids).forEach(([type, id]) => {
    assert.ok(typeof id === 'string', `${type} should be string`);
    assert.ok(id.length > 0, `${type} should not be empty`);
  });
});

test('integration: batch with all generators', () => {
  const sf = createSnowflake({ machineId: 0 });
  const generators = [uuidv4, uuidv7, ulid, () => nanoid(), cuid2, () => sf.next()];
  generators.forEach(gen => {
    const ids = batch(gen, 50);
    assert.strictEqual(ids.length, 50);
    assert.strictEqual(new Set(ids).size, 50);
  });
});

// ── Run ──────────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

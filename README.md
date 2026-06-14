# idkit

Zero-dependency ID generation library for Node.js. UUID v4, UUID v7, ULID, NanoID, Snowflake, and Cuid2 — all in one tiny package.

## Why?

Every project needs unique IDs. Most reach for `uuid` or `nanoid` — but what if you need ULID for sorting, Snowflake for distributed systems, or Cuid2 for collision resistance? That's 4+ packages with transitive deps. `idkit` gives you all of them in one zero-dependency package.

## Install

```bash
npm install idkit
```

## Quick Start

```js
const { uuidv4, uuidv7, ulid, nanoid, cuid2, createSnowflake } = require('idkit');

uuidv4();      // "f47ac10b-58cc-4372-a567-0e02b2c3d479"
uuidv7();      // "019ec665-b7f1-7b7f-9c66-5b7f1722fa1d" (time-ordered)
ulid();        // "01ARZ3NDEKTSV4RRFFQ69G5FAV" (sortable)
nanoid();      // "v3nbgx2kqj8mzrpt5w0uy" (compact, URL-safe)
cuid2();       // "clh6e8j3a0000pb8x2kqj8mzr" (collision-resistant)
const sf = createSnowflake({ machineId: 1 });
sf.next();     // "17665072866650673152" (64-bit distributed)
```

## API

### UUID v4 (`uuidv4`)

RFC 4122 compliant random UUID.

```js
const { uuidv4 } = require('idkit');

uuidv4();  // → "f47ac10b-58cc-4372-a567-0e02b2c3d479"
```

### UUID v7 (`uuidv7`)

RFC 9562 time-ordered UUID. First 48 bits encode a Unix millisecond timestamp, making IDs naturally sortable.

```js
const { uuidv7, uuidv7Timestamp } = require('idkit');

uuidv7();                          // → "019ec665-b7f1-7b7f-9c66-5b7f1722fa1d"
uuidv7(1700000000000);             // custom timestamp
uuidv7Timestamp('019ec665-b7f1-7b7f-9c66-5b7f1722fa1d');  // → 1700000000000
```

### ULID

26-character Crockford Base32 encoded, lexicographically sortable ID.

```js
const { ulid, ulidTimestamp } = require('idkit');

ulid();                // → "01ARZ3NDEKTSV4RRFFQ69G5FAV"
ulid(1700000000000);   // custom timestamp
ulidTimestamp('01ARZ3NDEKTSV4RRFFQ69G5FAV');  // → 1700000000000
```

### NanoID

Compact, URL-safe ID with configurable alphabet and size.

```js
const { nanoid, nanoidCustom } = require('idkit');

nanoid();                              // → "v3nbgx2kqj8mzrpt5w0uy" (21 chars)
nanoid({ size: 10 });                  // → "v3nbgx2kqj"
nanoid({ alphabet: 'ABC123', size: 8 }); // → "A1C3B2A1"
nanoidCustom('XYZ', 12);               // → "XZYXYZXZYZXY"
```

### Snowflake

Twitter-style 64-bit distributed ID generator. Encodes timestamp + machine ID + sequence number.

```js
const { createSnowflake, decodeSnowflake } = require('idkit');

const sf = createSnowflake({
  epoch: 1700000000000,  // custom epoch (default: Twitter epoch 1288834974657)
  machineId: 1,          // worker ID (0–1023, default 0)
});

sf.next();  // → "17665072866650673152"

decodeSnowflake('17665072866650673152', { epoch: 1700000000000 });
// → { timestamp: 1700000123456, machineId: 1, sequence: 0 }
```

Custom bit allocation:

```js
const sf = createSnowflake({
  machineIdBits: 8,    // default 10
  sequenceBits: 14,    // default 12
  machineId: 200,
});
```

### Cuid2

Collision-resistant IDs designed for horizontal scaling. Combines timestamp, counter, fingerprint, and randomness.

```js
const { cuid2 } = require('idkit');

cuid2();                // → "clh6e8j3a0000pb8x2kqj8mzr" (24 chars)
cuid2({ size: 32 });    // → longer ID
```

### Utilities

```js
const { batch, isValid } = require('idkit');

// Generate multiple IDs
batch(uuidv4, 5);      // → ["id1", "id2", "id3", "id4", "id5"]

// Validate ID formats
isValid('f47ac10b-58cc-4372-a567-0e02b2c3d479', 'uuidv4');  // → true
isValid('01ARZ3NDEKTSV4RRFFQ69G5FAV', 'ulid');               // → true
isValid('abc', 'uuid');                                        // → false
```

## CLI

```bash
# Generate a single ID
idkit uuid4
idkit uuid7
idkit ulid
idkit nano --size 12
idkit cuid
idkit snowflake --machine 1

# Batch generation
idkit batch 5 ulid
idkit batch 100 uuid4 --json

# Validate
idkit valid f47ac10b-58cc-4372-a567-0e02b2c3d479 uuidv4
```

## Comparison

| Format   | Length | Sortable | Distributed | Use Case |
|----------|--------|----------|-------------|----------|
| UUID v4  | 36     | ✗        | ✗           | General purpose |
| UUID v7  | 36     | ✓        | ✗           | Time-ordered, DB-friendly |
| ULID     | 26     | ✓        | ✗           | URL-short, sortable |
| NanoID   | 21     | ✗        | ✗           | Compact, URL-safe |
| Snowflake| ~18-20 | ✓        | ✓           | Distributed systems |
| Cuid2    | 24     | partial | ✓           | Collision-resistant |

## Zero Dependencies

No `uuid`, no `ulid`, no `nanoid` packages needed. Uses only Node.js built-in `crypto`.

## License

MIT

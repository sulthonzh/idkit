#!/usr/bin/env node
'use strict';

const { uuidv4, uuidv7, ulid, nanoid, cuid2, createSnowflake, batch, isValid } = require('./index');

const args = process.argv.slice(2);

function usage() {
  console.log(`idkit — ID generation CLI

Usage:
  idkit <command> [options]

Commands:
  uuid4              Generate UUID v4
  uuid7              Generate UUID v7 (time-ordered)
  ulid               Generate ULID
  nano               Generate NanoID
  cuid               Generate Cuid2
  snowflake          Generate Snowflake ID
  batch <n> <type>   Generate N IDs (uuid4|uuid7|ulid|nano|cuid)
  valid <id> <type>  Validate an ID format (uuid|uuidv4|uuidv7|ulid|nanoid)

Options:
  --size <n>         Size for nanoid (default 21)
  --machine <n>      Machine ID for snowflake (default 0)
  --epoch <n>        Custom epoch for snowflake
  --json             Output as JSON
  --count <n>        Count for batch (default 10)

Examples:
  idkit uuid4
  idkit uuid7
  idkit nano --size 12
  idkit batch 5 ulid
  idkit valid 01ARZ3NDEKTSV4RRFFQ69G5FAV ulid
`);
}

function gen(type, opts) {
  switch (type) {
    case 'uuid4': return uuidv4();
    case 'uuid7': return uuidv7();
    case 'ulid': return ulid();
    case 'nano': return nanoid({ size: opts.size });
    case 'cuid': return cuid2({ size: opts.size });
    case 'snowflake': {
      const sf = createSnowflake({ machineId: opts.machine, epoch: opts.epoch });
      return sf.next();
    }
    default: return null;
  }
}

const opts = { size: 21, machine: 0, epoch: undefined, json: false };
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--size') opts.size = parseInt(args[++i], 10);
  else if (args[i] === '--machine') opts.machine = parseInt(args[++i], 10);
  else if (args[i] === '--epoch') opts.epoch = parseInt(args[++i], 10);
  else if (args[i] === '--json') opts.json = true;
}

const cmd = args.find(a => !a.startsWith('--'));
const cmdIdx = args.indexOf(cmd);

if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
  usage();
  process.exit(0);
}

if (cmd === 'batch') {
  const n = parseInt(args[cmdIdx + 1], 10) || 10;
  const type = args[cmdIdx + 2] || 'uuid4';
  const ids = batch(() => gen(type, opts), n);
  if (opts.json) console.log(JSON.stringify(ids));
  else ids.forEach(id => console.log(id));
} else if (cmd === 'valid') {
  const id = args[cmdIdx + 1];
  const type = args[cmdIdx + 2] || 'uuid';
  const result = isValid(id, type);
  console.log(result ? 'valid' : 'invalid');
  if (!result) process.exit(1);
} else {
  const id = gen(cmd, opts);
  if (id) console.log(opts.json ? JSON.stringify({ id }) : id);
  else { usage(); process.exit(1); }
}

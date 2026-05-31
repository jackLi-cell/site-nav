const { createPoolFromEnv } = require('./mysql-utils');

const INDEXES = [
  {
    table: 'websites',
    name: 'idx_websites_public_rank',
    ddl: 'ALTER TABLE websites ADD INDEX idx_websites_public_rank (status, region, view_count DESC, id), ALGORITHM=INPLACE, LOCK=NONE',
    note: 'Optional. Existing idx_websites_sort is used by the optimized list queries; create this only during a maintenance window.',
  },
  {
    table: 'websites',
    name: 'idx_websites_public_latest',
    ddl: 'ALTER TABLE websites ADD INDEX idx_websites_public_latest (status, region, created_at DESC, id), ALGORITHM=INPLACE, LOCK=NONE',
    note: 'Optional. Existing idx_websites_created is used by latest queries; create this only if EXPLAIN still shows filesort.',
  },
];

async function indexExists(pool, table, name) {
  const [rows] = await pool.query(
    `SELECT 1
     FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND index_name = ?
     LIMIT 1`,
    [table, name]
  );
  return rows.length > 0;
}

function printUsage() {
  console.log([
    'Usage:',
    '  npm run db:optimize-indexes',
    '    Check recommended optional indexes. Does not change the database.',
    '',
    '  npm run db:optimize-indexes -- --create idx_websites_public_rank',
    '    Create one explicit optional index. Run only during a maintenance window.',
  ].join('\n'));
}

async function main() {
  const args = process.argv.slice(2);
  const createIndexName = args[0] === '--create' ? args[1] : null;
  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    return;
  }
  if (args.length > 0 && !createIndexName) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const pool = createPoolFromEnv();
  try {
    if (!createIndexName) {
      console.log('Checking optional query indexes; no DDL will be executed.');
    }

    for (const index of INDEXES) {
      const exists = await indexExists(pool, index.table, index.name);
      if (!createIndexName) {
        console.log(`${exists ? 'present' : 'missing'} ${index.name} on ${index.table}`);
        console.log(`  ${index.note}`);
        continue;
      }

      if (index.name !== createIndexName) {
        continue;
      }
      if (exists) {
        console.log(`skip ${index.name}; already present`);
        return;
      }

      console.log(`create ${index.name}`);
      await pool.query(index.ddl);
      console.log(`created ${index.name}`);
      return;
    }

    if (createIndexName && !INDEXES.some((index) => index.name === createIndexName)) {
      console.error(`Unknown index: ${createIndexName}`);
      printUsage();
      process.exitCode = 1;
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

#!/usr/bin/env node
/* global console, process */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';

import {
  TEST_CLEANUP_TABLES,
  buildTestDataCleanupPlan,
  getCleanupRowIdentifier,
  isSafeCleanupMarker,
} from '../src/shared/lib/testDataCleanup.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function printHelp() {
  console.log(`Usage:
  node scripts/cleanup-test-data.mjs --marker MYBIZ_E2E_YYYYMMDD_HHMM [--dry-run]
  node scripts/cleanup-test-data.mjs --ids cleanup-ids.json [--execute]

Options:
  --marker <marker>              Cleanup rows that visibly contain a safe MYBIZ_E2E marker.
  --ids <file>                   JSON with { "marker": "...", "exactIds": { "inquiries": ["..."] } }.
  --execute                      Actually delete planned rows. Default is dry-run.
  --allow-exact-id-only          Allow exact-id deletion for linked rows that do not carry the marker themselves.
  --env <file>                   Load env vars from a dotenv file. Can be repeated.

Safety:
  - Marker cleanup only accepts MYBIZ_E2E_YYYYMMDD_HHMM.
  - Dry-run is the default.
  - Exact-id-only deletion requires --allow-exact-id-only.
  - Fuzzy production-looking rows are refused, not deleted.
`);
}

function parseArgs(argv) {
  const args = {
    allowExactIdOnly: false,
    envFiles: [],
    execute: false,
    idsFile: '',
    marker: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
    if (arg === '--execute') {
      args.execute = true;
      continue;
    }
    if (arg === '--dry-run') {
      args.execute = false;
      continue;
    }
    if (arg === '--allow-exact-id-only') {
      args.allowExactIdOnly = true;
      continue;
    }
    if (arg === '--marker') {
      args.marker = argv[++index] || '';
      continue;
    }
    if (arg === '--ids') {
      args.idsFile = argv[++index] || '';
      continue;
    }
    if (arg === '--env') {
      args.envFiles.push(argv[++index] || '');
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function loadEnvFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    if (!line || /^\s*#/.test(line) || !line.includes('=')) {
      continue;
    }
    const separator = line.indexOf('=');
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] ||= value;
  }
}

function readIdsFile(filePath) {
  if (!filePath) {
    return {};
  }

  const parsed = JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
  return {
    exactIds: parsed.exactIds || {},
    marker: parsed.marker || '',
  };
}

const MARKER_QUERY_BUILDERS = {
  conversation_messages: (query, marker) => query.ilike('content', `%${marker}%`),
  customer_contacts: (query, marker) =>
    query.or(`raw_value.ilike.%${marker}%,normalized_value.ilike.%${marker}%`),
  customer_timeline_events: async (supabase, marker) => {
    const byName = await supabase
      .from('customer_timeline_events')
      .select('*')
      .filter('payload->>name', 'ilike', `%${marker}%`);
    const bySummary = await supabase
      .from('customer_timeline_events')
      .select('*')
      .filter('payload->>summary', 'ilike', `%${marker}%`);
    const rows = [...(byName.data || []), ...(bySummary.data || [])];
    return {
      data: rows.filter((row, index, allRows) => allRows.findIndex((candidate) => candidate.id === row.id) === index),
      error: byName.error || bySummary.error,
    };
  },
  inquiries: (query, marker) =>
    query.or(`contact_name.ilike.%${marker}%,contact_email.ilike.%${marker}%,subject.ilike.%${marker}%,summary.ilike.%${marker}%`),
  payment_events: (query, marker) => query.filter('raw->>note', 'ilike', `%${marker}%`),
  reservations: (query, marker) => query.ilike('notes', `%${marker}%`),
  visitor_sessions: (query, marker) => query.or(`ip_hash.ilike.%${marker}%,landing_path.ilike.%${marker}%`),
  waiting_entries: (query, marker) => query.or(`name_snapshot.ilike.%${marker}%,phone_snapshot.ilike.%${marker}%`),
};

async function fetchRowsByExactIds(supabase, exactIds) {
  const rowsByTable = {};

  for (const table of TEST_CLEANUP_TABLES) {
    const ids = exactIds[table] || [];
    if (!ids.length) {
      continue;
    }

    const idColumns = table === 'orders' ? ['order_id', 'id'] : table === 'customers' ? ['customer_id', 'id'] : ['id'];
    const rows = [];
    for (const column of idColumns) {
      const { data, error } = await supabase.from(table).select('*').in(column, ids);
      if (!error && data?.length) {
        rows.push(...data);
      }
    }
    rowsByTable[table] = rows.filter((row, index, allRows) => {
      const identifier = getCleanupRowIdentifier(table, row);
      return identifier && allRows.findIndex((candidate) => getCleanupRowIdentifier(table, candidate)?.id === identifier.id) === index;
    });
  }

  return rowsByTable;
}

async function fetchRowsByMarker(supabase, marker) {
  const rowsByTable = {};
  const warnings = [];

  for (const [table, builder] of Object.entries(MARKER_QUERY_BUILDERS)) {
    try {
      const result =
        typeof builder === 'function' && builder.constructor.name === 'AsyncFunction'
          ? await builder(supabase, marker)
          : await builder(supabase.from(table).select('*'), marker);
      if (result.error) {
        warnings.push({ error: result.error.message, table });
        continue;
      }
      rowsByTable[table] = result.data || [];
    } catch (error) {
      warnings.push({ error: error instanceof Error ? error.message : String(error), table });
    }
  }

  return { rowsByTable, warnings };
}

async function deleteRows(supabase, deletions) {
  const results = [];
  for (const deletion of deletions) {
    const { data, error } = await supabase
      .from(deletion.table)
      .delete()
      .eq(deletion.selectorColumn, deletion.id)
      .select(deletion.selectorColumn);
    results.push({
      ...deletion,
      deleted: data?.length || 0,
      error: error?.message,
    });
  }
  return results;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const idsInput = readIdsFile(args.idsFile);
  const marker = args.marker || idsInput.marker;
  const exactIds = idsInput.exactIds || {};

  if (!marker && !Object.keys(exactIds).length) {
    throw new Error('Provide --marker or --ids.');
  }
  if (marker && !isSafeCleanupMarker(marker)) {
    throw new Error(`Unsafe marker refused: ${marker}`);
  }

  const defaultEnvFiles = [
    path.join(ROOT, '.env.local'),
    path.join(ROOT, '.env.vercel.production'),
    path.join(ROOT, '.vercel', '.env.production.local'),
  ];
  for (const envFile of [...defaultEnvFiles, ...args.envFiles]) {
    loadEnvFile(envFile);
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const exactRows = await fetchRowsByExactIds(supabase, exactIds);
  const markerRows = marker && !Object.keys(exactIds).length ? await fetchRowsByMarker(supabase, marker) : { rowsByTable: {}, warnings: [] };
  const rowsByTable = { ...markerRows.rowsByTable, ...exactRows };

  const plan = buildTestDataCleanupPlan({
    allowExactIdOnly: args.allowExactIdOnly,
    exactIds,
    marker,
    mode: args.execute ? 'execute' : 'dry-run',
    rowsByTable,
  });

  const deleteResults = args.execute ? await deleteRows(supabase, plan.deletions) : [];
  console.log(JSON.stringify({ deleteResults, plan, warnings: markerRows.warnings }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

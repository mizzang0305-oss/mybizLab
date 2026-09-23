/* global console, process */
import { readFileSync } from 'node:fs';

const [baselinePath, candidatePath] = process.argv.slice(2);
if (!baselinePath || !candidatePath) {
  throw new Error('TWO_LOCAL_ADVISOR_RESULTS_REQUIRED');
}

function findings(path) {
  const source = JSON.parse(readFileSync(path, 'utf8'));
  const result = new Map();
  function visit(value, inheritedLevel = '') {
    if (Array.isArray(value)) {
      for (const item of value) visit(item, inheritedLevel);
      return;
    }
    if (!value || typeof value !== 'object') return;
    const item = value;
    const level = String(item.level ?? item.severity ?? inheritedLevel).toLowerCase();
    const name = String(item.name ?? item.id ?? item.rule_id ?? '');
    const table = String(item.table ?? item.table_name ?? '');
    if (['info', 'warn', 'warning', 'error'].includes(level) && name) {
      const normalizedLevel = level === 'warning' ? 'warn' : level;
      const key = `${normalizedLevel}:${name}:${table}`;
      result.set(key, { level: normalizedLevel, name, table });
    }
    for (const [key, child] of Object.entries(item)) {
      const childLevel = /^(errors?|warnings?|infos?)$/i.test(key)
        ? key.toLowerCase().replace(/s$/, '').replace('warning', 'warn')
        : inheritedLevel;
      visit(child, childLevel);
    }
  }
  visit(source);
  return result;
}

const baseline = findings(baselinePath);
const candidate = findings(candidatePath);
const counts = (items) => Object.fromEntries(['error', 'warn', 'info'].map((level) => [
  level, [...items.values()].filter((item) => item.level === level).length,
]));
const introducedErrors = [...candidate.entries()].filter(([key, item]) =>
  item.level === 'error' && !baseline.has(key));
console.log(`LOCAL_ADVISORS_BASELINE=${JSON.stringify(counts(baseline))}`);
console.log(`LOCAL_ADVISORS_CANDIDATE=${JSON.stringify(counts(candidate))}`);
console.log(`LOCAL_ADVISORS_NEW_ERRORS=${introducedErrors.length}`);
console.log(`LOCAL_ADVISORS_CLASSIFICATION=${candidate.size || baseline.size ? 'CLASSIFIED' : 'UNCLASSIFIED'}`);
if (introducedErrors.length) {
  process.exitCode = 1;
}

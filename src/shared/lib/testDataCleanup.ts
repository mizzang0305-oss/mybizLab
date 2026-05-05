export type CleanupMode = 'dry-run' | 'execute';

export type CleanupTable =
  | 'conversation_messages'
  | 'conversation_sessions'
  | 'customer_contacts'
  | 'customer_timeline_events'
  | 'customers'
  | 'inquiries'
  | 'orders'
  | 'payment_events'
  | 'reservations'
  | 'visitor_sessions'
  | 'waiting_entries';

export type CleanupRow = Record<string, unknown>;

export type CleanupPlanInput = {
  allowExactIdOnly?: boolean;
  exactIds?: Partial<Record<CleanupTable, string[]>>;
  marker?: string;
  mode: CleanupMode;
  rowsByTable: Partial<Record<CleanupTable, CleanupRow[]>>;
};

export type CleanupDecision = {
  id: string;
  mode: CleanupMode;
  reason: 'exact-id' | 'exact-id+marker' | 'marker';
  selectorColumn: string;
  table: CleanupTable;
};

export type CleanupRefusal = {
  id: string;
  reason:
    | 'exact-id-without-test-marker'
    | 'missing-row-id'
    | 'missing-test-marker'
    | 'not-selected-by-exact-id'
    | 'unsafe-marker';
  table: CleanupTable;
};

const TABLE_ID_COLUMNS: Record<CleanupTable, string[]> = {
  conversation_messages: ['id'],
  conversation_sessions: ['id'],
  customer_contacts: ['id'],
  customer_timeline_events: ['id'],
  customers: ['customer_id', 'id'],
  inquiries: ['id'],
  orders: ['order_id', 'id'],
  payment_events: ['id'],
  reservations: ['id'],
  visitor_sessions: ['id'],
  waiting_entries: ['id'],
};

export const TEST_CLEANUP_TABLES = Object.freeze(Object.keys(TABLE_ID_COLUMNS) as CleanupTable[]);

export function isSafeCleanupMarker(marker: string | null | undefined) {
  return /^MYBIZ_E2E_\d{8}_\d{4}$/.test(marker?.trim() || '');
}

export function getCleanupRowIdentifier(table: CleanupTable, row: CleanupRow) {
  for (const column of TABLE_ID_COLUMNS[table]) {
    const value = row[column];
    if (typeof value === 'string' && value.trim()) {
      return {
        column,
        id: value.trim(),
      };
    }
  }

  return null;
}

function rowContainsMarker(row: CleanupRow, marker: string) {
  return JSON.stringify(row).includes(marker);
}

export function buildTestDataCleanupPlan(input: CleanupPlanInput) {
  const marker = input.marker?.trim() || '';
  const safeMarker = isSafeCleanupMarker(marker);
  const deletions: CleanupDecision[] = [];
  const refused: CleanupRefusal[] = [];

  for (const table of TEST_CLEANUP_TABLES) {
    const rows = input.rowsByTable[table] || [];
    const exactIds = new Set(input.exactIds?.[table] || []);
    const hasExactIds = exactIds.size > 0;

    for (const row of rows) {
      const identifier = getCleanupRowIdentifier(table, row);
      if (!identifier) {
        refused.push({ id: '<missing>', reason: 'missing-row-id', table });
        continue;
      }

      const hasMarker = marker ? rowContainsMarker(row, marker) : false;
      const selectedByExactId = exactIds.has(identifier.id);

      if (hasExactIds && !selectedByExactId) {
        refused.push({ id: identifier.id, reason: 'not-selected-by-exact-id', table });
        continue;
      }

      if (selectedByExactId) {
        if (hasMarker) {
          deletions.push({
            id: identifier.id,
            mode: input.mode,
            reason: 'exact-id+marker',
            selectorColumn: identifier.column,
            table,
          });
          continue;
        }

        if (input.allowExactIdOnly) {
          deletions.push({
            id: identifier.id,
            mode: input.mode,
            reason: 'exact-id',
            selectorColumn: identifier.column,
            table,
          });
          continue;
        }

        refused.push({ id: identifier.id, reason: 'exact-id-without-test-marker', table });
        continue;
      }

      if (!safeMarker) {
        refused.push({ id: identifier.id, reason: 'unsafe-marker', table });
        continue;
      }

      if (hasMarker) {
        deletions.push({
          id: identifier.id,
          mode: input.mode,
          reason: 'marker',
          selectorColumn: identifier.column,
          table,
        });
        continue;
      }

      refused.push({ id: identifier.id, reason: 'missing-test-marker', table });
    }
  }

  return {
    deletions,
    refused,
    summary: {
      deleteCount: deletions.length,
      refusedCount: refused.length,
    },
  };
}


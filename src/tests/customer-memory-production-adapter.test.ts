import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  createProductionCustomerMemorySchemaAdapter,
  sanitizeCustomerMemoryTimelinePayload,
} from '@/server/mybiz/repositories/customerMemoryProductionAdapter';
import { submitCustomerMemoryInquiryIntake } from '@/server/mybiz/services/customerMemoryIntakeService';

type TableName = 'customers' | 'customer_contacts' | 'inquiries' | 'customer_timeline_events';
type Row = Record<string, unknown>;

interface TableCall {
  operation: 'insert' | 'select' | 'upsert';
  options?: unknown;
  payload?: unknown;
  table: string;
}

class FakeQuery {
  private filters: Array<(row: Row) => boolean> = [];
  private limitCount?: number;

  constructor(
    private readonly rows: Row[],
    private readonly calls: TableCall[],
    private readonly table: string,
    private readonly columns: string,
  ) {}

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  in(column: string, values: unknown[]) {
    const allowed = new Set(values);
    this.filters.push((row) => allowed.has(row[column]));
    return this;
  }

  order() {
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  then<TResult1 = { data: Row[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: Row[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    let data = this.rows.filter((row) => this.filters.every((filter) => filter(row)));
    if (this.limitCount !== undefined) {
      data = data.slice(0, this.limitCount);
    }
    this.calls.push({ operation: 'select', payload: { columns: this.columns }, table: this.table });
    return Promise.resolve({ data, error: null }).then(onfulfilled, onrejected);
  }
}

function createFakeCustomerMemoryClient(seed: Partial<Record<TableName, Row[]>> = {}) {
  const tables: Record<TableName, Row[]> = {
    customer_contacts: [...(seed.customer_contacts || [])],
    customer_timeline_events: [...(seed.customer_timeline_events || [])],
    customers: [...(seed.customers || [])],
    inquiries: [...(seed.inquiries || [])],
  };
  const calls: TableCall[] = [];

  return {
    calls,
    from(table: TableName) {
      return {
        insert(payload: Row) {
          calls.push({ operation: 'insert', payload, table });
          tables[table].unshift(payload);
          return Promise.resolve({ error: null });
        },
        select(columns: string) {
          return new FakeQuery(tables[table], calls, table, columns);
        },
        upsert(payload: Row, options?: unknown) {
          calls.push({ operation: 'upsert', options, payload, table });
          const primaryKey = table === 'customers' ? 'customer_id' : 'id';
          const existingIndex = tables[table].findIndex((row) => row[primaryKey] === payload[primaryKey]);
          if (existingIndex >= 0) {
            tables[table][existingIndex] = {
              ...tables[table][existingIndex],
              ...payload,
            };
          } else {
            tables[table].unshift(payload);
          }

          return Promise.resolve({ error: null });
        },
      };
    },
    tables,
  };
}

function executableSql(sql: string) {
  return sql
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n');
}

function intake(overrides: Partial<Parameters<typeof submitCustomerMemoryInquiryIntake>[0]> = {}) {
  return {
    email: 'visitor@example.test',
    marketingOptIn: true,
    message: 'I want to ask about a reservation and repeat visit preferences.',
    name: 'Visitor Alpha',
    phone: '010-1234-5678',
    source: 'public_inquiry' as const,
    storeId: 'store_a',
    summary: 'Public inquiry captured.',
    tags: ['reservation'],
    ...overrides,
  };
}

describe('customer memory production schema adapter', () => {
  it('maps production customer/contact rows while isolating contacts through customer store scope', async () => {
    const fake = createFakeCustomerMemoryClient({
      customer_contacts: [
        {
          id: 'contact_a',
          customer_id: 'customer_a',
          contact_type: 'phone',
          raw_value: '010-1111-2222',
          normalized_value: '01011112222',
          is_primary: true,
          is_verified: false,
          created_at: '2026-06-15T00:00:00.000Z',
        },
        {
          id: 'contact_b',
          customer_id: 'customer_b',
          contact_type: 'phone',
          raw_value: '010-1111-2222',
          normalized_value: '01011112222',
          is_primary: true,
          is_verified: false,
          created_at: '2026-06-15T00:00:00.000Z',
        },
      ],
      customers: [
        {
          customer_id: 'customer_a',
          store_id: 'store_a',
          customer_key: '01011112222',
          first_seen_at: '2026-06-15T00:00:00.000Z',
          last_seen_at: '2026-06-15T00:00:00.000Z',
          marketing_consent: true,
        },
        {
          customer_id: 'customer_b',
          store_id: 'store_b',
          customer_key: '01011112222',
          first_seen_at: '2026-06-15T00:00:00.000Z',
          last_seen_at: '2026-06-15T00:00:00.000Z',
          marketing_consent: true,
        },
      ],
    });
    const repository = createProductionCustomerMemorySchemaAdapter(fake as never, {
      broadDbWriteEnabled: true,
      customerMemorySpineEnabled: true,
      liveCustomerMemoryWriteEnabled: true,
    });

    const contacts = await repository.listCustomerContacts('store_a');

    expect(contacts).toHaveLength(1);
    expect(contacts[0]).toMatchObject({
      customer_id: 'customer_a',
      normalized_value: '01011112222',
      store_id: 'store_a',
      type: 'phone',
    });
  });

  it('dedupes same-store phone while keeping the same phone isolated across stores', async () => {
    const fake = createFakeCustomerMemoryClient();
    const repository = createProductionCustomerMemorySchemaAdapter(fake as never, {
      broadDbWriteEnabled: true,
      customerMemorySpineEnabled: true,
      liveCustomerMemoryWriteEnabled: true,
    });

    const first = await submitCustomerMemoryInquiryIntake(intake({ storeId: 'store_a' }), { repository });
    const second = await submitCustomerMemoryInquiryIntake(intake({ name: 'Visitor Updated', phone: '010 1234 5678', storeId: 'store_a' }), {
      repository,
    });
    const crossStore = await submitCustomerMemoryInquiryIntake(
      intake({ email: 'other-store@example.test', name: 'Other Store', storeId: 'store_b' }),
      { repository },
    );

    expect(second.created).toBe(false);
    expect(second.customer.customer_id).toBe(first.customer.customer_id);
    expect(crossStore.created).toBe(true);
    expect(crossStore.customer.customer_id).not.toBe(first.customer.customer_id);
  });

  it('uses email as secondary dedupe when phone is absent', async () => {
    const fake = createFakeCustomerMemoryClient();
    const repository = createProductionCustomerMemorySchemaAdapter(fake as never, {
      broadDbWriteEnabled: true,
      customerMemorySpineEnabled: true,
      liveCustomerMemoryWriteEnabled: true,
    });

    const first = await submitCustomerMemoryInquiryIntake(intake({ email: 'EMAIL-ONLY@example.test', phone: undefined }), { repository });
    const second = await submitCustomerMemoryInquiryIntake(intake({ email: 'email-only@example.test', name: 'Email Updated', phone: undefined }), {
      repository,
    });

    expect(second.created).toBe(false);
    expect(second.customer.customer_id).toBe(first.customer.customer_id);
  });

  it('maps inquiries and timeline events into production columns without raw PII in timeline payload', async () => {
    const fake = createFakeCustomerMemoryClient();
    const repository = createProductionCustomerMemorySchemaAdapter(fake as never, {
      broadDbWriteEnabled: true,
      customerMemorySpineEnabled: true,
      liveCustomerMemoryWriteEnabled: true,
    });

    const result = await submitCustomerMemoryInquiryIntake(intake(), { repository });
    const inquiryPayloads = fake.calls.filter((call) => call.table === 'inquiries' && call.operation === 'upsert').map((call) => call.payload as Row);
    const timelinePayloads = fake.calls.filter((call) => call.table === 'customer_timeline_events').map((call) => call.payload as Row);
    const serializedTimeline = JSON.stringify(timelinePayloads);

    expect(result.timelineEvents.map((event) => event.event_type)).toEqual([
      'customer_created',
      'contact_added',
      'inquiry_created',
      'inquiry_linked_to_customer',
    ]);
    expect(inquiryPayloads[0]).toMatchObject({
      customer_id: result.customer.customer_id,
      intent: 'reservation',
      status: 'new',
      store_id: 'store_a',
      summary: 'I want to ask about a reservation and repeat visit preferences.',
    });
    expect(timelinePayloads[0]).toMatchObject({
      customer_id: result.customer.customer_id,
      event_type: 'customer_created',
      store_id: 'store_a',
    });
    expect(serializedTimeline).not.toContain('visitor@example.test');
    expect(serializedTimeline).not.toContain('010-1234-5678');
    expect(serializedTimeline).not.toContain('Visitor Alpha');
  });

  it('blocks production adapter writes when broad or live customer memory gates are disabled', async () => {
    const fake = createFakeCustomerMemoryClient();
    const repository = createProductionCustomerMemorySchemaAdapter(fake as never, {
      broadDbWriteEnabled: false,
      customerMemorySpineEnabled: true,
      liveCustomerMemoryWriteEnabled: false,
    });

    await expect(submitCustomerMemoryInquiryIntake(intake(), { repository })).rejects.toThrow('BROAD_DB_WRITE_DISABLED');
    expect(fake.calls.filter((call) => call.operation === 'upsert' || call.operation === 'insert')).toHaveLength(0);
  });

  it('sanitizes timeline payload keys and values defensively', () => {
    const payload = sanitizeCustomerMemoryTimelinePayload({
      contactName: 'Visitor Alpha',
      email: 'visitor@example.test',
      memo: 'Reach me at visitor@example.test or 010-1234-5678.',
      phone: '010-1234-5678',
      safeFlag: true,
    });

    expect(payload).toEqual({
      memo: 'Reach me at [email] or [phone].',
      safeFlag: true,
    });
  });

  it('adds only a draft customer memory schema alignment migration and keeps sales Excel untouched', () => {
    const activeMigrations = readdirSync(resolve(process.cwd(), 'supabase/migrations'));
    const draftMigrations = activeMigrations.filter((name) => name.endsWith('_customer_memory_schema_alignment.sql'));

    expect(draftMigrations).toHaveLength(1);
    expect(existsSync(resolve(process.cwd(), 'supabase/migrations', draftMigrations[0] || ''))).toBe(true);

    const draftSql = readFileSync(resolve(process.cwd(), 'supabase/migrations', draftMigrations[0] || ''), 'utf8');
    const executableDraftSql = executableSql(draftSql);
    expect(draftSql).toContain('DRAFT ONLY');
    expect(draftSql).toContain('customer_contacts_store_phone_unique');
    expect(draftSql).toContain('customer_contacts_store_email_unique');
    expect(executableDraftSql).not.toMatch(/\bdrop\s+table\b/i);
    expect(executableDraftSql).not.toMatch(/\btruncate\b/i);
    expect(executableDraftSql).not.toMatch(/\bdelete\s+from\b/i);
    expect(executableDraftSql).not.toMatch(/\bgrant\b/i);
    expect(executableDraftSql).not.toMatch(/\brevoke\b/i);

    const changedSalesExcelFiles = [
      ...readdirSync(resolve(process.cwd(), 'docs')),
      ...readdirSync(resolve(process.cwd(), 'src/tests')),
    ].filter((name) => /sales|excel|xlsx|xls|csv/i.test(name));
    expect(changedSalesExcelFiles).toEqual([]);
  });

  it('does not log raw PII while mapping through the production adapter', async () => {
    const logSpy = vi.spyOn(console, 'log');
    const warnSpy = vi.spyOn(console, 'warn');
    const errorSpy = vi.spyOn(console, 'error');
    const fake = createFakeCustomerMemoryClient();
    const repository = createProductionCustomerMemorySchemaAdapter(fake as never, {
      broadDbWriteEnabled: true,
      customerMemorySpineEnabled: true,
      liveCustomerMemoryWriteEnabled: true,
    });

    await submitCustomerMemoryInquiryIntake(intake(), { repository });

    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

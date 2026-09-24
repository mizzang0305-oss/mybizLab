import { beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const statusFile = process.env.LOCAL_SUPABASE_STATUS_FILE;

describe.runIf(Boolean(statusFile) && process.env.LOCAL_R5_PRIVACY === '1')('R5 raw Data API privacy on real local Auth/PostgREST', () => {
  let dbUrl: string;
  let apiUrl: string;
  let anonKey: string;
  let serviceKey: string;
  let memberToken: string;
  let nonmemberToken: string;
  let ownStore: string;
  let otherStore: string;

  function sql(query: string) {
    if (!/^postgres(?:ql)?:\/\/[^@]+@127\.0\.0\.1:\d+\/postgres$/.test(dbUrl)) {
      throw new Error('LOCAL_DB_ONLY');
    }
    return execFileSync('psql', [dbUrl, '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', query], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  }

  async function createIdentity() {
    const email = `r5-${randomUUID()}@example.test`;
    const password = `${randomUUID()}${randomUUID()}`;
    const admin = createClient(apiUrl, serviceKey, { auth: { persistSession: false } });
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    expect(created.error).toBeNull();
    const browser = createClient(apiUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const session = await browser.auth.signInWithPassword({ email, password });
    expect(session.error).toBeNull();
    return { id: created.data.user!.id, token: session.data.session!.access_token };
  }

  async function rest(table: string, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', token: string, key: string, storeId?: string, body?: object) {
    const query = storeId ? `?store_id=eq.${storeId}&select=*` : '?select=*';
    const response = await fetch(`${apiUrl}/rest/v1/${table}${query}`, {
      method,
      headers: {
        apikey: key,
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        prefer: 'return=representation',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, body: await response.json() as unknown };
  }

  beforeAll(async () => {
    const vars = Object.fromEntries(readFileSync(statusFile!, 'utf8').split(/\r?\n/)
      .map((line) => line.replace(/^export\s+/, '').match(/^([A-Z_]+)=(.*)$/))
      .filter((match): match is RegExpMatchArray => Boolean(match))
      .map((match) => [match[1], match[2].replace(/^['"]|['"]$/g, '')]));
    dbUrl = vars.DB_URL;
    apiUrl = vars.API_URL || vars.SUPABASE_URL;
    anonKey = vars.ANON_KEY || vars.PUBLISHABLE_KEY;
    serviceKey = vars.SERVICE_ROLE_KEY || vars.SECRET_KEY;
    if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(apiUrl) || !anonKey || !serviceKey) throw new Error('LOCAL_SUPABASE_ONLY');
    const [member, other] = await Promise.all([createIdentity(), createIdentity()]);
    const nonmember = await createIdentity();
    memberToken = member.token;
    nonmemberToken = nonmember.token;
    ownStore = randomUUID();
    otherStore = randomUUID();
    sql(`insert into public.profiles(id,full_name) values ('${member.id}','Synthetic'),('${other.id}','Synthetic');
      insert into public.stores(store_id,name,slug) values
        ('${ownStore}','Synthetic A','r5-${ownStore}'),('${otherStore}','Synthetic B','r5-${otherStore}');
      insert into public.store_members(store_id,profile_id,role) values
        ('${ownStore}','${member.id}','owner'),('${otherStore}','${other.id}','owner');
      insert into public.store_home_content(store_id,hero_title) values
        ('${ownStore}','Synthetic private A'),('${otherStore}','Synthetic private B');
      insert into public.store_priority_settings(store_id) values ('${otherStore}');`);
  });

  it('has exactly the two intended RLS/ACL surfaces and protected helper', () => {
    const posture = sql(`select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname in ('store_home_content','store_priority_settings')
        and c.relrowsecurity and not c.relforcerowsecurity`);
    expect(posture).toBe('2');
    const noBrowserHome = sql(`select not has_table_privilege('anon','public.store_home_content','SELECT')
      and not has_table_privilege('authenticated','public.store_home_content','SELECT')
      and has_table_privilege('service_role','public.store_home_content','SELECT')`);
    expect(noBrowserHome).toBe('t');
    const priorityGrants = sql(`select not has_table_privilege('anon','public.store_priority_settings','SELECT')
      and has_table_privilege('authenticated','public.store_priority_settings','SELECT')
      and has_table_privilege('authenticated','public.store_priority_settings','INSERT')
      and has_table_privilege('authenticated','public.store_priority_settings','UPDATE')
      and not has_table_privilege('authenticated','public.store_priority_settings','DELETE')`);
    expect(priorityGrants).toBe('t');
    const helperAcl = sql(`select not has_function_privilege('anon','private.is_legacy_text_store_member(text)','EXECUTE')
      and has_function_privilege('authenticated','private.is_legacy_text_store_member(text)','EXECUTE')`);
    expect(helperAcl).toBe('t');
    expect(sql(`select count(*) from pg_policies where schemaname='public'
      and tablename='store_priority_settings' and cmd in ('SELECT','INSERT','UPDATE')`)).toBe('3');
  });

  it('denies raw home content to anon and authenticated while preserving service read', async () => {
    for (const token of [anonKey, memberToken]) {
      for (const method of ['GET', 'POST', 'PATCH', 'DELETE'] as const) {
        const body = method === 'POST' ? { store_id: randomUUID(), hero_title: 'Denied' }
          : method === 'PATCH' ? { hero_title: 'Denied' } : undefined;
        const result = await rest('store_home_content', method, token, anonKey, ownStore, body);
        expect([401, 403], `${method} status ${result.status}`).toContain(result.status);
      }
    }
    const service = await rest('store_home_content', 'GET', serviceKey, serviceKey, ownStore);
    expect(service.status).toBe(200);
    expect(service.body).toEqual([expect.objectContaining({ store_id: ownStore })]);
    expect(sql(`select hero_title from public.store_home_content where store_id='${ownStore}'`)).toBe('Synthetic private A');
  });

  it('denies every anon priority operation and authenticated DELETE', async () => {
    for (const method of ['GET', 'POST', 'PATCH', 'DELETE'] as const) {
      const body = method === 'POST' ? { store_id: randomUUID() }
        : method === 'PATCH' ? { revenue_weight: 1 } : undefined;
      const result = await rest('store_priority_settings', method, anonKey, anonKey, otherStore, body);
      expect([401, 403], `${method} status ${result.status}`).toContain(result.status);
    }
    const deletion = await rest('store_priority_settings', 'DELETE', memberToken, anonKey, otherStore);
    expect([401, 403]).toContain(deletion.status);
  });

  it('allows only own-store priority SELECT, INSERT and UPDATE', async () => {
    const ownInsert = await rest('store_priority_settings', 'POST', memberToken, anonKey, undefined, { store_id: ownStore });
    expect(ownInsert.status).toBe(201);
    const ownRead = await rest('store_priority_settings', 'GET', memberToken, anonKey, ownStore);
    expect(ownRead.body).toEqual([expect.objectContaining({ store_id: ownStore })]);
    const ownUpdate = await rest('store_priority_settings', 'PATCH', memberToken, anonKey, ownStore, { revenue_weight: 0.4 });
    expect(ownUpdate.status).toBe(200);
    expect(ownUpdate.body).toEqual([expect.objectContaining({ store_id: ownStore, revenue_weight: 0.4 })]);

    for (const token of [memberToken, nonmemberToken]) {
      const deniedStore = token === memberToken ? otherStore : ownStore;
      const read = await rest('store_priority_settings', 'GET', token, anonKey, deniedStore);
      expect(read.status).toBe(200);
      expect(read.body).toEqual([]);
      const insert = await rest('store_priority_settings', 'POST', token, anonKey, undefined, { store_id: randomUUID() });
      expect([401, 403]).toContain(insert.status);
      const update = await rest('store_priority_settings', 'PATCH', token, anonKey, deniedStore, { revenue_weight: 0.9 });
      expect(update.status).toBe(200);
      expect(update.body).toEqual([]);
    }
    expect(sql(`select revenue_weight from public.store_priority_settings where store_id='${otherStore}'`)).not.toBe('0.9');
    expect(Number(sql(`select count(*) from public.store_priority_settings where store_id='${ownStore}'`))).toBe(1);
  });
});

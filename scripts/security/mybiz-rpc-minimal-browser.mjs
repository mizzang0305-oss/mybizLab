/* global console, process, setTimeout */
import { execFileSync, spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const statusFile = process.env.LOCAL_SUPABASE_STATUS_FILE;
if (!statusFile) throw new Error('LOCAL_SUPABASE_STATUS_REQUIRED');
const vars = Object.fromEntries(readFileSync(statusFile, 'utf8').split(/\r?\n/)
  .map((line) => line.replace(/^export\s+/, '').match(/^([A-Z_]+)=(.*)$/))
  .filter(Boolean)
  .map((match) => [match[1], match[2].replace(/^['"]|['"]$/g, '')]));
const dbUrl = vars.DB_URL;
const apiUrl = vars.API_URL || vars.SUPABASE_URL;
const serviceKey = vars.SERVICE_ROLE_KEY || vars.SECRET_KEY;
if (!/^postgres(?:ql)?:\/\/[^@]+@127\.0\.0\.1:\d+\/postgres$/.test(dbUrl)
  || !/^http:\/\/127\.0\.0\.1:\d+$/.test(apiUrl) || !serviceKey) {
  throw new Error('LOCAL_SUPABASE_ONLY');
}
function sql(query) {
  return execFileSync('psql', [dbUrl, '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', query], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}
const email = `browser-${randomUUID()}@example.test`;
const password = `${randomUUID()}${randomUUID()}`;
const admin = createClient(apiUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (created.error || !created.data.user?.id) throw new Error('SYNTHETIC_AUTH_CREATE_FAILED');
const actorId = created.data.user.id;
sql(`insert into public.profiles(id,full_name,email) values ('${actorId}','Synthetic','${email}');
  insert into private.profile_auth_bindings(public_profile_id,auth_profile_id,binding_source,status)
  values ('${actorId}','${actorId}','EXACT_ID','ACTIVE');`);

let server;
async function startServer(canaryEnv = {}) {
  server = spawn('node', ['scripts/security/serve-mybiz-rpc-browser.mjs'], {
    env: { ...process.env, LOCAL_SUPABASE_STATUS_FILE: statusFile,
      MYBIZ_PROVISIONING_MODE: 'HOLD', ...canaryEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    let output = '';
    server.stdout.on('data', (chunk) => {
      output += chunk.toString();
      if (output.includes('LOCAL_BROWSER_SERVER_READY')) resolve();
    });
    server.on('exit', (code) => reject(new Error(`LOCAL_BROWSER_SERVER_EXIT_${code}`)));
    setTimeout(() => reject(new Error('LOCAL_BROWSER_SERVER_TIMEOUT')), 20000);
  });
}
async function stopServer() {
  if (!server || server.exitCode !== null) return;
  const stopped = new Promise((resolve) => server.once('exit', resolve));
  server.kill('SIGTERM');
  await stopped;
}
function hash(value) { return createHash('sha256').update(value).digest('hex'); }
let browser;
try {
  await startServer();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
  page.on('pageerror', (error) => {
    const message = error.message;
    const failureClass = /PROVISION_POST_RPC_[A-Z_]+/.exec(message)?.[0]
      ?? (message.includes('Failed to save store public page') ? 'PUBLIC_PAGE_WRITE'
      : message.includes('Failed to verify') ? 'POST_RPC_VERIFY_READ'
        : message.includes('스토어 생성 후') ? 'POST_RPC_VERIFY_ROW'
          : message.includes('Failed to load') ? 'REPOSITORY_READ'
            : message.includes('Cannot read') ? 'CLIENT_RUNTIME_TYPE'
              : 'OTHER');
    console.log(`BROWSER_PAGE_ERROR_CLASS=${failureClass}`);
  });
  page.on('console', (message) => {
    if (message.type() === 'error' && message.text().includes('[onboarding] activation failed')) {
      const category = /PROVISION_POST_RPC_[A-Z_]+|PUBLIC_PAGE_WRITE|POST_RPC_VERIFY|REPOSITORY_READ|OTHER/.exec(message.text())?.[0] ?? 'OTHER';
      console.log(`BROWSER_ACTIVATION_FAILURE_CLASS=${category}`);
    }
  });
  page.on('response', (response) => {
    const pathname = new URL(response.url()).pathname;
    if (pathname === '/api/stores/provision') {
      console.log(`BROWSER_PROVISION_HTTP=${response.status()}`);
    } else if (response.status() >= 400 && (pathname.startsWith('/rest/v1/') || pathname.startsWith('/api/'))) {
      console.log(`BROWSER_API_FAILURE=${pathname}:${response.status()}`);
    }
  });
  let attemptedBody;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/stores/provision') {
      attemptedBody = request.postDataJSON();
    }
  });
  await page.route('**/*', (route) => {
    const target = new URL(route.request().url());
    return target.hostname === '127.0.0.1' ? route.continue() : route.abort();
  });
  const base = 'http://127.0.0.1:33162';
  await page.goto(`${base}/login?next=/onboarding`);
  await page.getByLabel('이메일').fill(email);
  await page.getByLabel('비밀번호').fill(password);
  await page.getByRole('button', { name: '이메일로 로그인' }).click();
  await page.waitForURL((url) => url.pathname === '/onboarding', { timeout: 20000 });
  const jwt = await page.evaluate(async () => {
    const { supabase } = await import('/src/integrations/supabase/client.ts');
    return (await supabase.auth.getSession()).data.session?.access_token ?? null;
  });
  if (!jwt) throw new Error('BROWSER_LOGIN_LOST_AUTH_SESSION');
  console.log('BROWSER_EXISTING_AUTH_LOGIN=PASS');

  await page.getByLabel(/매장 주소/).fill('Synthetic Seoul Service District');
  await page.getByRole('button', { name: /서비스업/ }).click();
  await page.getByRole('button', { name: /AI 상권 분석/ }).click();
  await page.getByRole('button', { name: '다음 단계로 계속' }).click({ timeout: 30000 });
  const slug = `browser-${randomUUID().slice(0, 8)}`;
  await page.getByRole('textbox', { name: /^스토어명$/ }).fill('Synthetic Service');
  await page.getByRole('textbox', { name: /^브랜드명$/ }).fill('Synthetic Service');
  await page.getByRole('textbox', { name: /^대표자명$/ }).fill('Synthetic Owner');
  await page.getByRole('textbox', { name: /^연락처$/ }).fill('0000000000');
  await page.getByRole('textbox', { name: /^이메일$/ }).fill(email);
  await page.getByRole('textbox', { name: /^업종/ }).fill('service');
  await page.getByRole('textbox', { name: /^주소$/ }).fill('Synthetic Seoul Service District');
  await page.getByRole('textbox', { name: /^스토어 주소/ }).fill(slug);
  for (let step = 0; step < 5; step++) {
    await page.getByRole('button', { name: '다음 단계', exact: true }).click();
  }
  await page.getByRole('button', { name: '스토어 생성 요청 제출' }).click();
  await page.getByText('스토어 생성 요청이 접수되었습니다.').waitFor({ timeout: 20000 });
  await page.goto(`${base}/onboarding?portone=redirect&paymentId=forged-local-only`);
  await page.getByText('유료 업체 생성과 결제는 별도 승인 전까지 지원하지 않습니다.').waitFor({ timeout: 20000 });
  console.log('BROWSER_PAID_REDIRECT_HOLD=PASS');
  await page.getByRole('button', { name: /FREE.*월 0원/ }).click({ timeout: 20000 });
  const heldResponse = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/stores/provision');
  await page.getByRole('button', { name: 'FREE 플랜 바로 시작' }).click();
  if ((await heldResponse).status() !== 503 || !attemptedBody?.request_id) {
    throw new Error('BROWSER_DEFAULT_HOLD_FAILED');
  }
  await page.getByText('현재 업체 생성은 보류 중입니다. 작성한 신청 내용은 유지됩니다.').waitFor();
  if (Number(sql(`select count(*) from private.store_provisioning_receipts where actor_auth_user_id='${actorId}'`)) !== 0) {
    throw new Error('BROWSER_HOLD_CREATED_RECEIPT');
  }
  console.log('BROWSER_DEFAULT_HOLD=PASS');
  const normalized = [attemptedBody.business_name.trim(), attemptedBody.owner_name.trim(),
    attemptedBody.business_number.trim(), attemptedBody.phone.trim(),
    attemptedBody.email.trim().toLowerCase(), attemptedBody.address.trim(),
    attemptedBody.business_type.trim(), attemptedBody.requested_slug.trim(), 'free', null];
  const requestKeyHash = hash(attemptedBody.request_id);
  const payloadHash = hash(JSON.stringify(normalized));
  const expiresAt = new Date(Date.now() + 60_000).toISOString();
  sql(`update private.store_provisioning_release_control set mode='CANARY',
    actor_auth_user_id='${actorId}', request_key_sha256='${requestKeyHash}',
    payload_sha256='${payloadHash}', expires_at='${expiresAt}' where singleton=true`);
  await stopServer();
  await startServer({
    MYBIZ_PROVISIONING_MODE: 'CANARY',
    MYBIZ_PROVISIONING_CANARY_AUTH_USER_ID: actorId,
    MYBIZ_PROVISIONING_CANARY_REQUEST_KEY_SHA256: requestKeyHash,
    MYBIZ_PROVISIONING_CANARY_PAYLOAD_SHA256: payloadHash,
    MYBIZ_PROVISIONING_CANARY_EXPIRES_AT: expiresAt,
  });
  await page.reload();
  await page.getByRole('button', { name: 'FREE 플랜 바로 시작' }).click();
  try {
    await page.waitForFunction(() => globalThis.location.pathname.startsWith('/dashboard/stores/')
      || globalThis.document.body.innerText.includes('스토어 생성에 실패했습니다.'), undefined, { timeout: 30000 });
    if (!new URL(page.url()).pathname.startsWith('/dashboard/stores/')) {
      throw new Error('BROWSER_ACTIVATION_ERROR');
    }
  } catch (error) {
    console.log(`BROWSER_RECEIPT_COUNT=${sql(`select count(*) from private.store_provisioning_receipts where actor_auth_user_id='${actorId}'`)}`);
    console.log(`BROWSER_MEMBERSHIP_COUNT=${sql(`select count(*) from public.store_members where profile_id='${actorId}' and role='owner'`)}`);
    const storeId = sql(`select store_id from private.store_provisioning_receipts where actor_auth_user_id='${actorId}' limit 1`);
    if (storeId) {
      for (const table of ['stores', 'store_members', 'store_analytics_profiles', 'store_priority_settings', 'store_public_pages']) {
        console.log(`BROWSER_DB_${table.toUpperCase()}_COUNT=${sql(`select count(*) from public.${table} where store_id='${storeId}'`)}`);
      }
      const browserReads = await page.evaluate(async (id) => {
        const { supabase } = await import('/src/integrations/supabase/client.ts');
        const tables = ['stores', 'store_members', 'store_analytics_profiles', 'store_priority_settings'];
        return Promise.all(tables.map(async (table) => {
          const result = await supabase.from(table).select('*', { count: 'exact', head: true }).eq('store_id', id);
          return { table, count: result.count, code: result.error?.code ?? null };
        }));
      }, storeId);
      for (const read of browserReads) {
        console.log(`BROWSER_READ_${read.table.toUpperCase()}=${read.count ?? 'NULL'}:${read.code ?? 'OK'}`);
      }
    }
    const failureVisible = await page.getByText('스토어 생성에 실패했습니다.', { exact: false }).isVisible().catch(() => false);
    console.log(`BROWSER_ACTIVATION_ERROR_VISIBLE=${failureVisible}`);
    throw error;
  }
  const count = Number(sql(`select count(*) from public.store_members where profile_id='${actorId}' and role='owner'`));
  const receipt = Number(sql(`select count(*) from private.store_provisioning_receipts where actor_auth_user_id='${actorId}'`));
  const publicPage = Number(sql(`select count(*) from public.store_public_pages p
    join private.store_provisioning_receipts r on r.store_id=p.store_id
    where r.actor_auth_user_id='${actorId}' and p.id=p.store_id and p.is_published=false
      and p.inquiry_enabled=false and p.reservation_enabled=false and p.waiting_enabled=false`));
  const ownStoreRead = await page.evaluate(async () => {
    const { supabase } = await import('/src/integrations/supabase/client.ts');
    const storeId = globalThis.location.pathname.split('/').at(-1);
    const { count: visible, error } = await supabase.from('stores')
      .select('store_id', { count: 'exact', head: true }).eq('store_id', storeId);
    return !error && visible === 1;
  });
  if (count !== 1 || receipt !== 1 || publicPage !== 1 || !ownStoreRead) {
    throw new Error('BROWSER_PROVISIONING_ROWS_MISMATCH');
  }
  console.log('BROWSER_FREE_ONBOARDING=PASS');
  console.log('BROWSER_STORE_MEMBERSHIP=1');
  console.log('BROWSER_PROVISIONING_RECEIPT=1');
  console.log('BROWSER_PUBLIC_PAGE_STABLE_UUID=1');
  sql(`update private.store_provisioning_release_control set mode='HOLD',
    actor_auth_user_id=null,request_key_sha256=null,payload_sha256=null,
    expires_at=null where singleton=true`);
  console.log('BROWSER_RETURNED_TO_DB_HOLD=PASS');
  console.log('BROWSER_OWN_STORE_READ=PASS');
} finally {
  if (browser) await browser.close();
  await stopServer();
}

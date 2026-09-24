/* global console, process, setTimeout */
import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
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

const server = spawn('node', ['scripts/security/serve-mybiz-rpc-browser.mjs'], {
  env: { ...process.env, LOCAL_SUPABASE_STATUS_FILE: statusFile },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let browser;
try {
  const ready = new Promise((resolve, reject) => {
    let output = '';
    server.stdout.on('data', (chunk) => {
      output += chunk.toString();
      if (output.includes('LOCAL_BROWSER_SERVER_READY')) resolve();
    });
    server.on('exit', (code) => reject(new Error(`LOCAL_BROWSER_SERVER_EXIT_${code}`)));
    setTimeout(() => reject(new Error('LOCAL_BROWSER_SERVER_TIMEOUT')), 20000);
  });
  await ready;
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
  page.on('response', (response) => {
    const pathname = new URL(response.url()).pathname;
    if (pathname === '/api/stores/provision') {
      console.log(`BROWSER_PROVISION_HTTP=${response.status()}`);
    } else if (response.status() >= 400 && (pathname.startsWith('/rest/v1/') || pathname.startsWith('/api/'))) {
      console.log(`BROWSER_API_FAILURE=${pathname}:${response.status()}`);
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
    const failureVisible = await page.getByText('스토어 생성에 실패했습니다.', { exact: false }).isVisible().catch(() => false);
    console.log(`BROWSER_ACTIVATION_ERROR_VISIBLE=${failureVisible}`);
    throw error;
  }
  const count = Number(sql(`select count(*) from public.store_members where profile_id='${actorId}' and role='owner'`));
  const receipt = Number(sql(`select count(*) from private.store_provisioning_receipts where actor_auth_user_id='${actorId}'`));
  if (count !== 1 || receipt !== 1) throw new Error('BROWSER_PROVISIONING_ROWS_MISMATCH');
  console.log('BROWSER_FREE_ONBOARDING=PASS');
  console.log('BROWSER_STORE_MEMBERSHIP=1');
  console.log('BROWSER_PROVISIONING_RECEIPT=1');
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}

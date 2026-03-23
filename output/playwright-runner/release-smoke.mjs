import fs from 'node:fs';
import path from 'node:path';

import { chromium } from 'playwright';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:4174';
const artifactDir = path.resolve('../playwright');

const session = {
  accessibleStoreIds: ['store_golden_coffee', 'store_mint_bbq', 'store_seoul_buffet'],
  authenticatedAt: new Date().toISOString(),
  email: 'demo@mybizlab.ai',
  fullName: 'Demo Owner',
  profileId: 'profile_platform_owner',
  provider: 'local',
  role: 'platform_owner',
};

const results = [];
const pageErrors = [];
const consoleErrors = [];
const requestFailures = [];

fs.mkdirSync(artifactDir, { recursive: true });

function record(name, ok, detail) {
  results.push({ name, ok, detail });
}

function ensureIncludes(haystack, needles, label) {
  for (const needle of needles) {
    if (!haystack.includes(needle)) {
      throw new Error(`${label}: missing "${needle}"`);
    }
  }
}

async function collectBodyText(page) {
  return (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim();
}

async function saveShot(page, filename) {
  await page.screenshot({ fullPage: true, path: path.join(artifactDir, filename) });
}

async function buildContext(browser, viewport = { width: 1440, height: 1100 }) {
  const context = await browser.newContext({ viewport });

  context.on('page', (page) => {
    page.on('pageerror', (error) => {
      if (!error.message.includes("Failed to read the 'localStorage' property from 'Window'")) {
        pageErrors.push(error.message);
      }
    });
    page.on('console', (message) => {
      if (message.type() === 'error' && !message.text().includes('404')) {
        consoleErrors.push(message.text());
      }
    });
    page.on('requestfailed', (request) => {
      const failureText = `${request.method()} ${request.url()} :: ${request.failure()?.errorText || 'failed'}`;
      if (!failureText.includes('/api/ai/diagnosis') && !failureText.includes('fonts.gstatic.com')) {
        requestFailures.push(failureText);
      }
    });
  });

  return context;
}

async function createAuthenticatedPage(browser, storeId, viewport) {
  const context = await buildContext(browser, viewport);
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    ({ adminSession, selectedStoreId }) => {
      window.localStorage.setItem('mybizlab:admin-session', JSON.stringify(adminSession));
      window.localStorage.setItem('mybizlab:ui-state', JSON.stringify({ selectedStoreId }));
    },
    { adminSession: session, selectedStoreId: storeId },
  );
  return { context, page };
}

async function runCheck(name, fn) {
  try {
    await fn();
    record(name, true, 'ok');
  } catch (error) {
    record(name, false, error instanceof Error ? error.message : String(error));
  }
}

async function verifyAuth(browser) {
  await runCheck('auth:redirect-and-dashboard-access', async () => {
    const anonContext = await buildContext(browser);
    const anonPage = await anonContext.newPage();
    await anonPage.goto(`${baseUrl}/dashboard`, { waitUntil: 'networkidle' });
    ensureIncludes(anonPage.url(), ['/login'], 'dashboard redirect');
    await anonContext.close();

    const { context, page } = await createAuthenticatedPage(browser, 'store_golden_coffee');
    await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'networkidle' });
    const text = await collectBodyText(page);
    ensureIncludes(text, ['Owner Dashboard', 'Simple operating snapshot'], 'authorized dashboard');
    await saveShot(page, 'dashboard-auth-check.png');
    await context.close();
  });
}

async function verifyPublicPages(browser) {
  const cases = [
    ['/golden-coffee', ['Golden Coffee', 'Owner-friendly summary']],
    ['/mint-izakaya', ['Mint Izakaya', 'Owner-friendly summary', 'Start inquiry']],
    ['/seoul-buffet-house', ['Seoul Buffet House', 'Owner-friendly summary', 'Open guest survey']],
  ];

  for (const [route, expected] of cases) {
    await runCheck(`public:${route}`, async () => {
      const context = await buildContext(browser);
      const page = await context.newPage();
      await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
      const text = await collectBodyText(page);
      ensureIncludes(text, expected, route);
      await saveShot(page, `${route.replace(/\//g, '')}.png`);
      await context.close();
    });
  }
}

async function verifyOnboarding(browser) {
  await runCheck('onboarding:diagnosis-to-wizard', async () => {
    const context = await buildContext(browser);
    const page = await context.newPage();

    await page.goto(`${baseUrl}/onboarding`, { waitUntil: 'networkidle' });
    await page.locator('input.input-base').first().fill('서울 성수동');

    for (const stepName of ['Step 1', 'Step 2', 'Step 3', 'Step 4', 'Step 5']) {
      const section = page.locator('section').filter({ has: page.getByText(stepName, { exact: true }) }).first();
      await section.locator('button').first().click();
    }

    await page.getByRole('button', { name: 'AI 진단 결과 보기' }).click();
    await page.getByRole('button', { name: '스토어 생성 요청 계속' }).click();

    const basicInputs = page.locator('input.input-base');
    await basicInputs.nth(0).fill('성수 브런치 하우스');
    await basicInputs.nth(1).fill('Aurora Brunch');
    await basicInputs.nth(2).fill('김데모');
    await basicInputs.nth(3).fill('010-1234-5678');
    await basicInputs.nth(4).fill('owner@example.com');
    await basicInputs.nth(5).fill('브런치 카페');
    await basicInputs.nth(6).fill('서울 성동구 성수이로 98');
    await basicInputs.nth(7).fill('매일 10:00 - 21:00');
    await basicInputs.nth(8).fill('seongsu-brunch-house');

    for (let index = 0; index < 4; index += 1) {
      await page.getByRole('button', { name: '다음 단계' }).click();
    }

    await page.getByLabel('대표 문구').fill('오늘 운영 흐름을 한 화면에서 보여주는 브런치 데모');
    await page.getByLabel('소개 문구').fill('공개 대문, 설문, CRM, 대시보드 흐름을 점주 눈높이로 설명하는 영업용 스토어입니다.');
    await page.getByLabel('기본 CTA 문구').fill('대문 보기');
    await page.getByLabel('모바일 CTA 문구').fill('바로 열기');
    await page.getByRole('button', { name: '다음 단계' }).click();

    const text = await collectBodyText(page);
    ensureIncludes(text, ['Store Mode', 'Data Mode'], 'wizard summary');
    await saveShot(page, 'onboarding-summary.png');
    await context.close();
  });
}

async function verifyDashboard(browser) {
  const cases = [
    ['store_golden_coffee', ['Owner Dashboard', 'This store should start with menu response and order movement.', 'Order + survey']],
    ['store_mint_bbq', ['Owner Dashboard', 'This store should connect order flow and customer feedback on one screen.', 'Order + survey + manual']],
    ['store_seoul_buffet', ['Owner Dashboard', 'This store should start with customer voice and service quality.', 'Survey + manual']],
  ];

  for (const [storeId, expected] of cases) {
    await runCheck(`dashboard:${storeId}`, async () => {
      const { context, page } = await createAuthenticatedPage(browser, storeId);
      await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'networkidle' });
      const text = await collectBodyText(page);
      ensureIncludes(text, expected, storeId);
      if (storeId === 'store_seoul_buffet') {
        await saveShot(page, 'dashboard-buffet.png');
      }
      await context.close();
    });
  }
}

async function verifySurveyAndInsights(browser) {
  await runCheck('survey-builder-response-ai', async () => {
    const { context, page } = await createAuthenticatedPage(browser, 'store_golden_coffee');

    await page.goto(`${baseUrl}/dashboard/surveys`, { waitUntil: 'networkidle' });
    let text = await collectBodyText(page);
    ensureIncludes(text, ['Owner-friendly feedback forms', 'Survey forms', 'Mobile preview'], 'survey builder');

    await page.goto(`${baseUrl}/s/store_golden_coffee/survey/survey_menu_pulse?tableCode=T1`, { waitUntil: 'networkidle' });
    await page.getByLabel('Your name (optional)').fill('Smoke Guest');
    await page.getByRole('button', { name: '5', exact: true }).click();
    await page.getByRole('button', { name: 'Coffee taste' }).click();
    await page.getByRole('button', { name: 'Yes' }).click();
    await page.locator('textarea').fill('Please keep the pastry warm near lunch time.');
    await page.getByRole('button', { name: 'Submit response' }).click();

    text = await collectBodyText(page);
    ensureIncludes(text, ['Response received', 'Submit another response'], 'public survey response');

    await page.goto(`${baseUrl}/dashboard/ai-reports`, { waitUntil: 'networkidle' });
    text = await collectBodyText(page);
    ensureIncludes(text, ['Owner-ready insight', 'AI 인사이트', '문제 TOP3', '실행 액션 카드'], 'ai insight');
    await saveShot(page, 'ai-insight.png');
    await context.close();
  });
}

async function verifyInquiryAndCrm(browser) {
  await runCheck('inquiry-and-crm', async () => {
    const { context, page } = await createAuthenticatedPage(browser, 'store_mint_bbq');

    await page.goto(`${baseUrl}/s/store_mint_bbq/inquiry`, { waitUntil: 'networkidle' });
    await page.getByLabel('Name').fill('Smoke Lead');
    await page.getByLabel('Phone').fill('010-5555-1212');
    await page.getByLabel('Email').fill('smoke-lead@example.com');
    await page.getByLabel('Preferred visit date').fill('2026-03-30');
    await page.getByRole('button', { name: 'Group' }).click();
    await page.getByRole('textbox', { name: 'Message' }).fill('We need a simple dinner demo for 10 guests next week.');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Submit inquiry' }).click();

    let text = await collectBodyText(page);
    ensureIncludes(text, ['Inquiry received', 'Total leads'], 'public inquiry');

    await page.goto(`${baseUrl}/dashboard/customers`, { waitUntil: 'networkidle' });
    text = await collectBodyText(page);
    ensureIncludes(text, ['Owner CRM', 'CRM and inquiry inbox', 'Smoke Lead'], 'crm inbox');
    await saveShot(page, 'crm-inbox.png');
    await context.close();
  });
}

async function verifyMetrics(browser) {
  await runCheck('sales-metric-entry', async () => {
    const { context, page } = await createAuthenticatedPage(browser, 'store_golden_coffee');

    await page.goto(`${baseUrl}/dashboard/sales`, { waitUntil: 'networkidle' });
    const numberInputs = page.locator('input[type="number"]');
    await numberInputs.nth(0).fill('580000');
    await numberInputs.nth(1).fill('142');
    await numberInputs.nth(2).fill('58');
    await numberInputs.nth(3).fill('64');
    await numberInputs.nth(4).fill('21');
    await numberInputs.nth(5).fill('9');
    await page.locator('textarea').fill('Smoke metric note');
    await page.locator('button.btn-primary').click();
    await page.waitForTimeout(1200);
    await page.reload({ waitUntil: 'networkidle' });

    const text = await collectBodyText(page);
    ensureIncludes(text, ['Smoke metric note'], 'sales metric');
    await saveShot(page, 'sales-metric.png');
    await context.close();
  });
}

async function verifyMobile(browser) {
  await runCheck('mobile:public-and-dashboard', async () => {
    const publicContext = await buildContext(browser, { width: 390, height: 844 });
    const publicPage = await publicContext.newPage();
    await publicPage.goto(`${baseUrl}/seoul-buffet-house`, { waitUntil: 'networkidle' });
    const publicText = await collectBodyText(publicPage);
    ensureIncludes(publicText, ['Seoul Buffet House', 'Open guest survey'], 'mobile public page');
    const publicLayout = await publicPage.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    if (publicLayout.scrollWidth - publicLayout.clientWidth > 8) {
      throw new Error(`mobile public overflow: ${publicLayout.scrollWidth} > ${publicLayout.clientWidth}`);
    }
    await saveShot(publicPage, 'mobile-public-buffet.png');
    await publicContext.close();

    const { context, page } = await createAuthenticatedPage(browser, 'store_seoul_buffet', { width: 390, height: 844 });
    await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'networkidle' });
    const dashboardText = await collectBodyText(page);
    ensureIncludes(dashboardText, ['Owner Dashboard', 'Simple operating snapshot'], 'mobile dashboard');
    const dashboardLayout = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    if (dashboardLayout.scrollWidth - dashboardLayout.clientWidth > 8) {
      throw new Error(`mobile dashboard overflow: ${dashboardLayout.scrollWidth} > ${dashboardLayout.clientWidth}`);
    }
    await saveShot(page, 'mobile-dashboard-buffet.png');
    await context.close();
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  try {
    await verifyAuth(browser);
    await verifyPublicPages(browser);
    await verifyOnboarding(browser);
    await verifyDashboard(browser);
    await verifySurveyAndInsights(browser);
    await verifyInquiryAndCrm(browser);
    await verifyMetrics(browser);
    await verifyMobile(browser);
  } finally {
    await browser.close();
  }

  const summary = {
    baseUrl,
    passed: results.filter((item) => item.ok).length,
    failed: results.filter((item) => !item.ok).length,
    results,
    pageErrors,
    consoleErrors,
    requestFailures,
  };

  fs.writeFileSync(path.join(artifactDir, 'release-smoke.json'), JSON.stringify(summary, null, 2));

  if (summary.failed > 0) {
    console.error(JSON.stringify(summary, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify(summary, null, 2));
}

await main();

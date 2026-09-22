/* global process, document, window, console, URLSearchParams, localStorage, sessionStorage, location, navigator */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:4173';
const evidenceDir = resolve(process.env.EVIDENCE_DIR || resolve(tmpdir(), 'mybiz-commercial-showroom-evidence'));
const viewports = [
  ['mobile-360', 360, 800],
  ['mobile-390', 390, 844],
  ['mobile-430', 430, 932],
  ['tablet-768', 768, 1024],
  ['tablet-1024', 1024, 768],
  ['desktop-1280', 1280, 800],
  ['desktop-1440', 1440, 900],
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

await mkdir(evidenceDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = { accessibility: {}, baseUrl, completedAt: null, interactions: [], pass: false, reducedMotion: {}, seo: {}, startedAt: new Date().toISOString(), viewports: [] };

try {
  for (const [name, width, height] of viewports) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    const geometry = await page.evaluate(() => ({
      bodyWidth: document.body.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      heroHeight: document.querySelector('[data-showroom-hero="true"]')?.getBoundingClientRect().height ?? 0,
      templates: document.querySelectorAll('#templates [role="tab"]').length,
    }));
    assert(geometry.bodyWidth <= geometry.clientWidth + 1, `${name}: horizontal overflow ${geometry.bodyWidth}/${geometry.clientWidth}`);
    assert(geometry.heroHeight > 300, `${name}: showroom hero did not render`);
    assert(geometry.templates === 6, `${name}: expected 6 template tabs, got ${geometry.templates}`);
    if (name === 'mobile-390' || name === 'desktop-1440') await page.screenshot({ path: resolve(evidenceDir, `${name}-hero.png`) });
    report.viewports.push({ ...geometry, height, name, pass: true, width });
    await context.close();
  }

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const consoleMessages = [];
  const inquiryNetworkRequests = [];
  page.on('console', (message) => consoleMessages.push(message.text()));
  page.on('request', (request) => {
    if (/owner(?:%40|@)example\.com|010-0000-0000/i.test(request.url())) inquiryNetworkRequests.push(request.url());
  });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });

  const templateTabs = page.locator('#templates [role="tab"]');
  assert(await templateTabs.count() === 6, 'template tab count mismatch');
  await templateTabs.first().focus();
  await page.keyboard.press('ArrowRight');
  assert(await templateTabs.nth(1).getAttribute('aria-selected') === 'true', 'template keyboard navigation failed');

  const demoRuns = [
    ['계약·결제 자동화 패키지', 'contract-next', '서명 준비'],
    ['SNS·콘텐츠 운영 패키지', 'content-review', '승인 대기'],
    ['고객·업무관리 패키지', 'crm-next', '상담'],
    ['ERP·WMS 내부 시스템', 'erp-filter', '표시 1건'],
  ];
  for (const [tabName, action, expectedText] of demoRuns) {
    await page.getByRole('tab', { name: tabName }).click();
    await page.locator(`[data-demo-action="${action}"]`).click();
    if (action === 'contract-next') await page.locator(`[data-demo-action="${action}"]`).click();
    assert(await page.locator('#template-detail').getByText(expectedText, { exact: false }).first().isVisible(), `${tabName}: interaction result missing`);
    report.interactions.push({ action, pass: true, template: tabName });
  }

  const brandName = page.locator('[data-brand-input="name"]');
  await brandName.fill('ABC 학원');
  assert(await page.locator('[data-brand-preview-title]').getByText('ABC 학원 Admin', { exact: true }).isVisible(), 'custom brand preview did not update');
  await page.locator('[data-brand-color="#3157A4"]').click();
  assert(await page.locator('[data-brand-color="#3157A4"]').getAttribute('aria-pressed') === 'true', 'brand color did not update');
  await page.locator('#make-it-yours').screenshot({ path: resolve(evidenceDir, 'make-it-yours.png') });
  report.interactions.push({ action: 'brand-preview', pass: true, value: 'ABC 학원 Admin' });

  const storyLast = page.locator('[data-story-index="6"]');
  await storyLast.evaluate((element) => element.scrollIntoView({ behavior: 'instant', block: 'center' }));
  await page.waitForTimeout(650);
  assert(await page.locator('#system-story').getByText('SYSTEM BUILD · 07/08', { exact: true }).isVisible(), 'forward scroll story did not activate scene 7');
  const storyFirst = page.locator('[data-story-index="0"]');
  await storyFirst.evaluate((element) => element.scrollIntoView({ behavior: 'instant', block: 'center' }));
  await page.waitForTimeout(650);
  assert(await page.locator('#system-story').getByText('SYSTEM BUILD · 01/08', { exact: true }).isVisible(), 'reverse scroll story did not restore scene 1');
  report.interactions.push({ action: 'scroll-story-forward-reverse', pass: true });

  const form = page.locator('#project-request form');
  await form.getByRole('button', { name: '요청 내용 검토하기' }).click();
  assert(await form.locator('[data-inquiry-status="invalid"]').isVisible(), 'empty inquiry validation did not fail closed');
  await form.locator('[data-inquiry-field="companyName"]').fill('ABC 학원');
  await form.locator('[data-inquiry-field="systemType"]').selectOption('crm-workflow');
  const originalProblem = '문의와 계약 진행 상태가 여러 문서에 흩어져 담당자가 놓칩니다.\n계약 정보도 함께 보고 싶습니다. 🧪';
  await form.locator('[data-inquiry-field="currentProblem"]').fill(originalProblem);
  await form.locator('input[type="checkbox"]').first().check();
  await form.getByLabel('사용자 규모').selectOption({ label: '6~20명' });
  await form.getByLabel('예상 일정').selectOption({ label: '3개월 이내' });
  await form.getByLabel('예상 예산').selectOption({ label: '견적 상담 후 결정' });
  await form.getByLabel('참고 사이트 / 서비스 (선택)').fill('https://example.com/?a=1&b=2#demo');
  await form.getByLabel('담당자명').fill('테스트 담당');
  await form.getByLabel('이메일').fill('owner@example.com');
  await form.getByRole('textbox', { name: /^연락처/ }).fill('010-0000-0000');
  await form.locator('input[type="checkbox"]').last().check();
  await form.getByRole('button', { name: '요청 내용 검토하기' }).click();
  const handoff = form.locator('[data-inquiry-status="review-ready"]');
  assert(await handoff.isVisible(), 'valid inquiry did not reach review-ready state');
  assert(await form.getByText('아직 접수되지 않음', { exact: false }).isVisible(), 'inquiry truthfulness status missing');
  const handoffBody = await handoff.locator('[data-inquiry-handoff-body]').inputValue();
  for (const value of ['ABC 학원', originalProblem, '고객관리', '6~20명', '3개월 이내', '견적 상담 후 결정', 'https://example.com/?a=1&b=2#demo', '테스트 담당', 'owner@example.com', '010-0000-0000']) {
    assert(handoffBody.includes(value), `inquiry handoff lost field: ${value}`);
  }
  const recipient = await handoff.getAttribute('data-inquiry-recipient');
  assert(Boolean(recipient), 'business recipient was not exposed for verification');
  const emailLink = handoff.locator('[data-inquiry-action="email"]');
  const emailHref = await emailLink.getAttribute('href');
  assert(emailHref?.startsWith(`mailto:${recipient}?`), 'mailto recipient does not match the rendered business inbox');
  const mailtoParams = new URLSearchParams(emailHref.split('?')[1]);
  assert(JSON.stringify([...mailtoParams.keys()]) === JSON.stringify(['subject', 'body']), 'mailto contains unexpected recipient-control parameters');
  assert(mailtoParams.get('body')?.includes(originalProblem.replace(/\n/g, '\r\n')), 'mailto body did not preserve UTF-8/CRLF request text');
  const urlBeforeEmail = page.url();
  await emailLink.evaluate((element) => element.addEventListener('click', (event) => event.preventDefault(), { once: true }));
  await emailLink.click();
  assert(page.url() === urlBeforeEmail, 'email verification navigated away from the request');
  assert(await handoff.getByText('실제 발송·수신 여부는 이 화면에서 확인할 수 없습니다.', { exact: false }).isVisible(), 'email action claimed an unsupported submission result');
  const browserPersistence = await page.evaluate(() => ({ local: JSON.stringify(localStorage), session: JSON.stringify(sessionStorage), url: location.href }));
  assert(!JSON.stringify(browserPersistence).includes('owner@example.com'), 'inquiry PII leaked into URL or browser storage');
  assert(inquiryNetworkRequests.length === 0, `inquiry PII appeared in a network request: ${inquiryNetworkRequests[0]}`);
  assert(!consoleMessages.some((message) => message.includes('owner@example.com') || message.includes('010-0000-0000')), 'inquiry PII appeared in console output');

  await form.locator('[data-inquiry-field="companyName"]').fill('ABC 학원 수정');
  assert(await form.locator('[data-inquiry-status="review-ready"]').count() === 0, 'editing the form did not invalidate the prior review snapshot');
  const longProblem = '매우 긴 요청서 원문입니다. 🧪\n'.repeat(700);
  await form.locator('[data-inquiry-field="currentProblem"]').fill(longProblem);
  await form.getByRole('button', { name: '요청 내용 검토하기' }).click();
  const longHandoff = form.locator('[data-inquiry-status="review-ready"]');
  assert(await longHandoff.getAttribute('data-handoff-mode') === 'copy_then_email', 'long request did not use the safe manual fallback');
  const longBody = await longHandoff.locator('[data-inquiry-handoff-body]').inputValue();
  assert(longBody.includes(longProblem.trim()), 'long request was truncated in the on-screen fallback');
  const longEmailHref = await longHandoff.locator('[data-inquiry-action="email"]').getAttribute('href');
  assert(longEmailHref && !new URLSearchParams(longEmailHref.split('?')[1]).has('body'), 'long mailto unexpectedly included an overlong body');
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }));
  await longHandoff.locator('[data-inquiry-action="copy"]').click();
  assert(await longHandoff.getByText('자동 복사를 사용할 수 없습니다.', { exact: false }).isVisible(), 'clipboard denial did not retain a manual-copy path');
  const selection = await longHandoff.locator('[data-inquiry-handoff-body]').evaluate((element) => ({ end: element.selectionEnd, length: element.value.length, start: element.selectionStart }));
  assert(selection.start === 0 && selection.end === selection.length, 'clipboard denial did not select the complete fallback body');
  const [download] = await Promise.all([page.waitForEvent('download'), longHandoff.locator('[data-inquiry-action="download"]').click()]);
  const downloadPath = await download.path();
  assert(download.suggestedFilename() === 'mybizlab-development-inquiry.txt' && downloadPath, 'request text download was not created');
  const downloadedDraft = await readFile(downloadPath, 'utf8');
  assert(downloadedDraft.replace(/\r\n/g, '\n').includes(longProblem.trim()), 'downloaded request text was truncated');
  report.interactions.push({ action: 'inquiry-handoff-preservation', emailOpened: false, longFallback: true, pass: true, persisted: false, recipient });

  const focusStyles = await page.locator('[data-inquiry-action="review"]').evaluate((element) => {
    element.focus();
    const style = window.getComputedStyle(element);
    return { minHeight: element.getBoundingClientRect().height, outlineStyle: style.outlineStyle };
  });
  assert(focusStyles.minHeight >= 44, `inquiry touch target is too small: ${focusStyles.minHeight}`);
  report.accessibility = { keyboardTabs: true, semanticHeadings: await page.locator('h1').count() === 1, touchTarget: focusStyles.minHeight, pass: true };
  report.seo = await page.evaluate(() => ({
    canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
    description: document.querySelector('meta[name="description"]')?.getAttribute('content'),
    jsonLd: Boolean(document.querySelector('script[data-mybiz-jsonld="page"]')),
    title: document.title,
  }));
  assert(report.seo.title.includes('맞춤형 웹 시스템'), `SEO title mismatch: ${report.seo.title}`);
  assert(report.seo.description?.includes('ERP·WMS'), 'SEO description mismatch');
  assert(report.seo.canonical === 'https://mybiz.ai.kr', `canonical mismatch: ${report.seo.canonical}`);
  assert(report.seo.jsonLd, 'structured metadata missing');
  await context.close();

  const reducedContext = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
  const reducedPage = await reducedContext.newPage();
  await reducedPage.goto(baseUrl, { waitUntil: 'networkidle' });
  const reduced = await reducedPage.locator('[data-story-sticky="true"]').evaluate((element) => ({ position: window.getComputedStyle(element).position }));
  assert(reduced.position === 'static', `reduced-motion story position is ${reduced.position}`);
  report.reducedMotion = { ...reduced, pass: true };
  await reducedContext.close();

  report.pass = true;
  report.completedAt = new Date().toISOString();
} catch (error) {
  report.completedAt = new Date().toISOString();
  report.error = error instanceof Error ? error.stack : String(error);
  throw error;
} finally {
  await writeFile(resolve(evidenceDir, 'showroom-browser-verification.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await browser.close();
}

console.log(JSON.stringify({ evidenceDir, interactions: report.interactions.length, pass: report.pass, viewports: report.viewports.length }));

/* global process, document, window, console */

import { mkdir, writeFile } from 'node:fs/promises';
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
  await form.locator('[data-inquiry-field="currentProblem"]').fill('문의와 계약 진행 상태가 여러 문서에 흩어져 담당자가 놓칩니다.');
  await form.locator('input[type="checkbox"]').first().check();
  await form.getByLabel('사용자 규모').selectOption({ label: '6~20명' });
  await form.getByLabel('예상 일정').selectOption({ label: '3개월 이내' });
  await form.getByLabel('예상 예산').selectOption({ label: '견적 상담 후 결정' });
  await form.getByLabel('담당자명').fill('테스트 담당');
  await form.getByLabel('이메일').fill('owner@example.com');
  await form.getByRole('textbox', { name: /^연락처/ }).fill('010-0000-0000');
  await form.locator('input[type="checkbox"]').last().check();
  await form.getByRole('button', { name: '요청 내용 검토하기' }).click();
  assert(await form.locator('[data-inquiry-status="review-ready"]').isVisible(), 'valid inquiry did not reach review-ready state');
  assert(await form.getByText('아직 접수되지 않음', { exact: false }).isVisible(), 'inquiry truthfulness status missing');
  report.interactions.push({ action: 'inquiry-validation-and-review', pass: true, persisted: false });

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

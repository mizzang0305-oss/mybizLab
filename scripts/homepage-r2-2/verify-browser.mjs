/* global process, console, document, URL, HTMLVideoElement */

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:4173';
const evidenceDir = resolve(process.env.EVIDENCE_DIR || 'artifacts/homepage-r2-2');
const viewports = [
  ['mobile-390', 390, 844],
  ['mobile-430', 430, 932],
  ['tablet-768', 768, 1024],
  ['laptop-1280', 1280, 800],
  ['desktop-1440', 1440, 900],
  ['wide-1920', 1920, 1080],
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

await mkdir(evidenceDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = { baseUrl, startedAt: new Date().toISOString(), viewports: [], industries: [], reducedMotion: null, errorFallback: null };

try {
  for (const [name, width, height] of viewports) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    const geometry = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: document.documentElement.clientWidth, heroWidth: document.querySelector('[data-hero-media]')?.getBoundingClientRect().width ?? 0 }));
    assert(geometry.body <= geometry.viewport + 1, `${name}: horizontal overflow ${geometry.body}/${geometry.viewport}`);
    assert(geometry.heroWidth > 0, `${name}: hero video has no rendered width`);
    if (name === 'mobile-390' || name === 'desktop-1440') await page.screenshot({ fullPage: true, path: resolve(evidenceDir, `${name}.png`) });
    report.viewports.push({ name, width, height, ...geometry, pass: true });
    await context.close();
  }

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const mediaRequests = [];
  page.on('request', (request) => { if (/\/media\/mybiz-stage2\/.+\.(mp4|webp)$/.test(request.url())) mediaRequests.push(new URL(request.url()).pathname); });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });

  for (const industry of ['cleaning', 'hair', 'installation']) {
    await page.getByRole('tab', { name: new RegExp(industry === 'cleaning' ? '^청소' : industry === 'hair' ? '^미용실' : '^설치·수리') }).click();
    const video = page.locator(`[data-hero-media="${industry}"]`);
    await video.scrollIntoViewIfNeeded();
    await video.waitFor({ state: 'visible' });
    await page.waitForTimeout(350);
    await page.waitForFunction((id) => { const el = document.querySelector(`[data-hero-media="${id}"]`); return el instanceof HTMLVideoElement && el.readyState >= 2 && Number.isFinite(el.duration); }, industry);
    const playbackControl = page.locator('button[aria-label="영상 재생"], button[aria-label="영상 일시정지"]').first();
    if (await video.evaluate((element) => element.paused)) await playbackControl.click();
    const start = await video.evaluate((element) => element.currentTime);
    await page.waitForTimeout(850);
    const media = await video.evaluate((element) => ({ currentTime: element.currentTime, duration: element.duration, width: element.videoWidth, height: element.videoHeight, paused: element.paused, src: new URL(element.currentSrc).pathname }));
    const advancedBy = (media.currentTime - start + media.duration) % media.duration;
    assert(advancedBy > 0.25, `${industry}: currentTime did not advance`);
    assert(media.duration > 11.8 && media.duration < 12.2, `${industry}: unexpected duration ${media.duration}`);
    assert(media.width === 960 && media.height >= 539 && media.height <= 541, `${industry}: unexpected desktop dimensions ${media.width}x${media.height}`);

    if (!(await video.evaluate((element) => element.paused))) await page.getByRole('button', { name: '영상 일시정지' }).click();
    assert(await video.evaluate((element) => element.paused), `${industry}: pause control failed`);
    await page.locator('[data-chapter="grow"]').click();
    const seekTime = await video.evaluate((element) => element.currentTime);
    assert(seekTime >= 9.15 && seekTime <= 9.55, `${industry}: chapter seek failed ${seekTime}`);
    const pairId = await page.locator('[data-before-after]').getAttribute('data-pair-id');
    assert(pairId?.startsWith(`${industry}-`), `${industry}: before/after pair is not synchronized`);
    report.industries.push({ industry, ...media, advancedBy, seekTime, pairId, pass: true });
  }

  await page.locator('#experience').scrollIntoViewIfNeeded();
  const approvalBoxes = page.locator('#experience input[type="checkbox"]');
  await approvalBoxes.nth(0).check();
  await approvalBoxes.nth(1).check();
  await approvalBoxes.nth(2).check();
  assert(await page.locator('[data-portfolio-eligible="true"]').isVisible(), 'three-part approval did not enable portfolio candidate');
  await page.getByRole('tab', { name: /^청소/ }).click();
  assert(await page.locator('#experience input[type="checkbox"]:checked').count() === 0, 'industry switch did not reset demo approvals');

  const basic = page.getByRole('tab', { name: 'Basic' });
  await basic.focus();
  await basic.press('ArrowRight');
  assert(await page.getByRole('tab', { name: 'Brand' }).getAttribute('aria-selected') === 'true', 'website package keyboard navigation failed');
  const fullScreenButton = page.getByRole('button', { name: '영상 크게 보기' });
  await fullScreenButton.click();
  assert(await page.getByRole('dialog').isVisible(), 'video dialog did not open');
  await page.keyboard.press('Escape');
  assert(await page.getByRole('dialog').count() === 0, 'video dialog did not close on Escape');

  const desktopVideoRequests = [...new Set(mediaRequests.filter((path) => path.endsWith('hero-desktop.mp4')))];
  const mobileVideoRequests = [...new Set(mediaRequests.filter((path) => path.endsWith('hero-mobile.mp4')))];
  assert(desktopVideoRequests.length === 3, `expected 3 desktop video requests, got ${desktopVideoRequests.length}`);
  assert(mobileVideoRequests.length === 0, `desktop loaded mobile renditions: ${mobileVideoRequests.join(', ')}`);
  report.mediaRequests = { desktopVideoRequests, mobileVideoRequests };
  await context.close();

  const reducedContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const reducedPage = await reducedContext.newPage();
  await reducedPage.goto(baseUrl, { waitUntil: 'networkidle' });
  const reduced = await reducedPage.locator('[data-hero-media]').evaluate((element) => ({ paused: element.paused, autoplay: element.autoplay, poster: element.poster }));
  assert(reduced.paused && !reduced.autoplay && reduced.poster.length > 0, 'reduced-motion fallback is not poster-first');
  report.reducedMotion = { ...reduced, pass: true };
  await reducedContext.close();

  const errorContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const errorPage = await errorContext.newPage();
  await errorPage.route('**/*.mp4', (route) => route.abort('failed'));
  await errorPage.goto(baseUrl, { waitUntil: 'networkidle' });
  await errorPage.waitForSelector('[data-hero-player="error"]');
  const fallbackVisible = await errorPage.getByAltText('청소 영상 대체 이미지').isVisible();
  assert(fallbackVisible, 'poster fallback is not visible after media failure');
  report.errorFallback = { fallbackVisible, pass: true };
  await errorContext.close();

  report.completedAt = new Date().toISOString();
  report.pass = true;
} catch (error) {
  report.completedAt = new Date().toISOString();
  report.pass = false;
  report.error = error instanceof Error ? error.stack : String(error);
  throw error;
} finally {
  await writeFile(resolve(evidenceDir, 'browser-verification.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await browser.close();
}

console.log(JSON.stringify({ pass: report.pass, evidenceDir, industries: report.industries.length, viewports: report.viewports.length }));

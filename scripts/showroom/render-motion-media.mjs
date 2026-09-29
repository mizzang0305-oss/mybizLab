/** Rebuild original showroom media locally. No HTTP fetch, DB, auth, payment or publishing. */
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
/* global URL, process, window, document, console */

import { createHash } from 'node:crypto';
import ts from 'typescript';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../../', import.meta.url));
const folder = resolve(root, 'src/pages/mybiz-field/showroom/motion');
const output = resolve(root, 'public/media/motion');
const runtime = await readFile(join(folder, 'motionRuntime.ts'), 'utf8');
const css = await readFile(join(folder, 'motionShowroom.css'), 'utf8');
const script = ts.transpileModule(runtime, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText.replace(/^export /gm, '');
const clips = [
  { id: 'soft-spotlight', kind: 'spotlight' },
  { id: 'magnetic-cta', kind: 'magnetic' },
  { id: 'editorial-reveal', kind: 'reveal' },
];
// Fail before writing artifacts when the encoder is missing. Never report a missing clip as rendered.
try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); }
catch { throw new Error('FFMPEG_REQUIRED: install/approve a local ffmpeg before running this renderer.'); }
await mkdir(output, { recursive: true });
const scratch = await mkdtemp(join(tmpdir(), 'mybiz-motion-'));
const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}),
});
const hashes = [];
try {
  for (const item of clips) {
    const frames = join(scratch, item.id); await mkdir(frames);
    const page = await browser.newPage({ viewport: { width: 600, height: 450 }, deviceScaleFactor: 1 });
    await page.setContent(`<!doctype html><html lang="ko"><meta charset="utf-8"><style>body{margin:0;background:#071019;font-family:Arial,sans-serif}${css}.mf-stage{height:450px;min-height:450px;padding:44px}.mf-stage-heading{font-size:48px}.mf-reveal-title{font-size:58px}.mf-project-plate strong{font-size:44px}.mf-project-plate{max-width:460px;padding:32px}</style><div id="host"></div></html>`);
    await page.addScriptTag({ content: `${script}\nwindow.disposeMotion=mountMotionStage(document.getElementById('host'),${JSON.stringify(item.kind)});` });
    const poster = join(frames, 'poster.png');
    await page.screenshot({ path: poster });
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', poster, '-quality', '88', join(output, `${item.id}.webp`)]);
    for (let frame = 0; frame < 60; frame++) {
      if (item.kind === 'spotlight') {
        await page.mouse.move(300 + 180 * Math.cos(frame / 59 * Math.PI * 2), 190 + 95 * Math.sin(frame / 59 * Math.PI * 2));
      } else if (item.kind === 'magnetic') {
        const bounds = await page.locator('.mf-magnetic-button').boundingBox();
        if (!bounds) throw new Error('CAPTURE_BUTTON_MISSING');
        await page.mouse.move(bounds.x + bounds.width * (0.5 + 0.4 * Math.sin(frame / 59 * Math.PI * 4)), bounds.y + bounds.height / 2);
      } else {
        if (frame === 5 || frame === 35) {
          await page.locator('.mf-replay-button').click();
          await page.evaluate(() => {
            window.captureAnimations = document.querySelector('.mf-reveal-title').getAnimations({ subtree: true });
            window.captureAnimations.forEach((animation) => animation.pause());
          });
        }
        if (frame >= 5) await page.evaluate((t) => window.captureAnimations.forEach((animation) => { animation.currentTime = t; }), (frame - (frame >= 35 ? 35 : 5)) / 15 * 1000);
      }
      await page.screenshot({ path: join(frames, `${String(frame).padStart(4, '0')}.png`) });
    }
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '15', '-i', join(frames, '%04d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', join(output, `${item.id}.mp4`)]);
    await page.close();
    for (const ext of ['webp', 'mp4']) {
      const file = `${item.id}.${ext}`;
      const bytes = await readFile(join(output, file));
      hashes.push({ path: `public/media/motion/${file}`, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length });
    }
  }
  await writeFile(join(output, 'render-manifest.json'), JSON.stringify({
    schemaVersion: 1,
    baseRepository: 'mizzang0305-oss/mybizLab',
    baseHead: 'ec5f806be7303637d2e8e2f816666fa72732d407',
    producer: 'local-original-motion-pilot',
    factoryLiveConnection: 'NOT_CONNECTED',
    release: 'CANDIDATE',
    commercialMode: 'HOMEPAGE_BUILD_INQUIRY_ONLY',
    codeCheckoutEnabled: false,
    productionApplied: false,
    sourcePath: 'src/pages/mybiz-field/showroom/motion/motionRuntime.ts',
    sourceSha256: createHash('sha256').update(runtime.replace(/\r\n/g, '\n')).digest('hex'),
    capture: {
      method: 'actual Chromium DOM screenshots; editorial reveal uses controlled Web Animations currentTime',
      thirdPartyMediaCopied: false,
      pointerMarker: 'capture-only pointer marker on spotlight/magnetic footage',
      performanceBenchmark: false,
      width: 600,
      height: 450,
      fps: 15,
      seconds: 4,
    },
    assets: hashes,
  }, null, 2) + '\n');
  console.log('RENDERED 3/3 clips. This is NOT a full app, sales, or Production certification.');
} finally {
  await browser.close();
  await rm(scratch, { recursive: true, force: true });
}

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import adminHandler from '../../api/admin';
import publicHandler from '../../api/public';
import { handleAdminPublicPageEventsRequest } from '@/server/mybiz/services/publicPageEventService';
import {
  buildMockPublicPageEvents,
  buildPublicPageEventReadModel,
  PUBLIC_PAGE_EVENT_TYPES,
  resolvePublicPageEventWriteDecision,
  sanitizePublicPageEventMetadata,
} from '@/shared/lib/services/publicPageEventReadModelService';

const STORE_A = 'store_public_events_a';
const STORE_B = 'store_public_events_b';
const PUBLIC_PAGE_ID = 'public_page_a';
const RAW_NETWORK_VALUE_MARKER = ['RAW', 'NETWORK', 'VALUE', 'SHOULD', 'NOT', 'SURFACE'].join('_');
const RAW_BROWSER_VALUE_MARKER = ['RAW', 'BROWSER', 'VALUE', 'SHOULD', 'NOT', 'SURFACE'].join('_');
const RAW_VISITOR_IDENTIFIER_MARKER = ['UNSAFE', 'VISITOR', 'IDENTIFIER', 'SHOULD', 'NOT', 'SURFACE'].join('_');
const RAW_CONTACT_VALUE_MARKER = ['REDACTED', 'TEST', 'CONTACT', 'VALUE', 'SHOULD', 'NOT', 'SURFACE'].join('_');

describe('Umami/PostHog-style public page event tracking contract', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defines the public page event type contract', () => {
    expect(PUBLIC_PAGE_EVENT_TYPES).toEqual([
      'public_page_view',
      'cta_click',
      'inquiry_started',
      'inquiry_submitted',
      'reservation_clicked',
      'waiting_clicked',
    ]);
  });

  it('builds a public page funnel summary from deterministic mock events', () => {
    const result = buildPublicPageEventReadModel({
      events: buildMockPublicPageEvents({
        publicPageId: PUBLIC_PAGE_ID,
        sourcePath: '/s/golden-cafe',
        storeId: STORE_A,
      }),
      storeId: STORE_A,
    });

    expect(result.summary).toMatchObject({
      ctaClickCount: 2,
      inquiryStartedCount: 1,
      inquirySubmittedCount: 1,
      pageViewCount: 3,
      reservationClickCount: 1,
      waitingClickCount: 1,
    });
    expect(result.summary.inquiryConversionRate).toBeCloseTo(33.33, 2);
    expect(result.events.every((event) => event.storeId === STORE_A)).toBe(true);
  });

  it('keeps store_id isolation for event read-model records', () => {
    const result = buildPublicPageEventReadModel({
      events: [
        ...buildMockPublicPageEvents({ storeId: STORE_A }),
        ...buildMockPublicPageEvents({ storeId: STORE_B }),
      ],
      storeId: STORE_A,
    });
    const serialized = JSON.stringify(result);

    expect(result.storeId).toBe(STORE_A);
    expect(result.events.every((event) => event.storeId === STORE_A)).toBe(true);
    expect(serialized).not.toContain(STORE_B);
  });

  it('keeps only safe metadata allowlist fields', () => {
    const safeMetadata = sanitizePublicPageEventMetadata({
      buttonId: 'hero-primary',
      campaign: 'spring_launch',
      ctaLabel: '문의하기',
      elementRole: 'primary_cta',
      fingerprint: RAW_VISITOR_IDENTIFIER_MARKER,
      ip: RAW_NETWORK_VALUE_MARKER,
      rawContact: RAW_CONTACT_VALUE_MARKER,
      source: 'hero',
      userAgent: RAW_BROWSER_VALUE_MARKER,
      variant: 'A',
      visitorIdentifier: RAW_VISITOR_IDENTIFIER_MARKER,
    });

    expect(safeMetadata).toEqual({
      buttonId: 'hero-primary',
      campaign: 'spring_launch',
      ctaLabel: '문의하기',
      elementRole: 'primary_cta',
      source: 'hero',
      variant: 'A',
    });
  });

  it('does not return raw IP, user-agent, fingerprint, or PII in event payloads', () => {
    const result = buildPublicPageEventReadModel({
      events: [
        {
          conversionTarget: 'inquiry',
          deviceType: 'mobile',
          eventId: 'event_private_payload',
          eventType: 'cta_click',
          occurredAt: '2026-06-15T09:01:00.000Z',
          publicPageId: PUBLIC_PAGE_ID,
          referrerDomain: 'search.example',
          safeMetadata: sanitizePublicPageEventMetadata({
            ctaLabel: 'Contact CTA',
            fingerprint: RAW_VISITOR_IDENTIFIER_MARKER,
            ip: RAW_NETWORK_VALUE_MARKER,
            rawContact: RAW_CONTACT_VALUE_MARKER,
            userAgent: RAW_BROWSER_VALUE_MARKER,
            visitorIdentifier: RAW_VISITOR_IDENTIFIER_MARKER,
          }),
          sourcePath: '/s/golden-cafe',
          storeId: STORE_A,
          visitorSessionId: 'session_redacted',
        },
      ],
      storeId: STORE_A,
    });
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain(RAW_NETWORK_VALUE_MARKER);
    expect(serialized).not.toContain(RAW_BROWSER_VALUE_MARKER);
    expect(serialized).not.toContain(RAW_VISITOR_IDENTIFIER_MARKER);
    expect(serialized).not.toContain(RAW_CONTACT_VALUE_MARKER);
  });

  it('keeps live public page event writes blocked by launch gates', () => {
    const decision = resolvePublicPageEventWriteDecision({
      broadDbWriteEnabled: false,
      livePublicPageEventWriteEnabled: false,
      publicPageEventTrackingEnabled: true,
    });

    expect(decision).toMatchObject({
      allowed: false,
      broadDbWriteEnabled: false,
      livePublicPageEventWriteEnabled: false,
      publicPageEventTrackingEnabled: true,
      reason: 'BROAD_DB_WRITE_DISABLED',
    });
  });

  it('serves read-only mock events through existing public and admin dispatchers only', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const publicResponse = await publicHandler(
      new Request(`https://mybiz.ai.kr/api/public?resource=public-page-events/preview&storeId=${STORE_A}`, {
        method: 'GET',
      }),
    );
    const unauthorizedAdmin = await adminHandler(
      new Request(`https://mybiz.ai.kr/api/admin?resource=public-page-funnel&storeId=${STORE_A}`, { method: 'GET' }),
    );
    const authorizedAdmin = await handleAdminPublicPageEventsRequest(
      new Request(`https://mybiz.ai.kr/api/admin/public-page-events?storeId=${STORE_A}`, {
        headers: { authorization: 'Bearer test' },
        method: 'GET',
      }),
      {
        resolveAdminAccess: async () => ({
          profileId: 'profile_test',
          storeId: STORE_A,
        }),
      },
    );

    expect(publicResponse.status).toBe(200);
    expect(unauthorizedAdmin.status).toBe(401);
    expect(authorizedAdmin.status).toBe(200);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(existsSync(resolve(process.cwd(), 'api/public/public-page-events.ts'))).toBe(false);
    expect(existsSync(resolve(process.cwd(), 'api/admin/public-page-events.ts'))).toBe(false);
  });

  it('documents boundaries and keeps migrations plus sales Excel import out of scope', () => {
    const doc = readFileSync(resolve(process.cwd(), 'docs/public-page-event-tracking-contract.md'), 'utf8');
    const brandPage = readFileSync(resolve(process.cwd(), 'src/modules/brand/page.tsx'), 'utf8');
    const launchGates = readFileSync(resolve(process.cwd(), 'src/shared/lib/launchGates.ts'), 'utf8');

    expect(doc).toContain('Umami/PostHog-style structure only');
    expect(doc).toContain('No Umami or PostHog source code is copied');
    expect(doc).toContain('No external analytics server is connected');
    expect(doc).toContain('No production analytics SDK is inserted');
    expect(doc).toContain('IP, user-agent, and fingerprint values must not be stored');
    expect(doc).toContain('Sales Excel import is out of scope');
    expect(brandPage).toContain('공개페이지 전환 분석');
    expect(brandPage).toContain('mock/read-only');
    expect(brandPage).toContain('tracking activation disabled');
    expect(launchGates).toMatch(/publicPageEventTrackingEnabled:\s*true/);
    expect(launchGates).toMatch(/livePublicPageEventWriteEnabled:\s*false/);
    expect(readdirSync(resolve(process.cwd(), 'supabase/migrations'))).toEqual([
      '20260614_production_baseline_adoption.sql',
    ]);
  });
});

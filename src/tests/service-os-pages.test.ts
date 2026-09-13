import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { BrandSitePreviewPage } from '@/pages/service-os/BrandSitePreviewPage';
import { CustomerConfirmationDemoPage, DEMO_CONFIRMATION_TOKEN } from '@/pages/service-os/CustomerConfirmationDemoPage';
import { ServiceOsDemoPage } from '@/pages/service-os/ServiceOsDemoPage';

function renderAt(path: string, routePath: string, element: ReactElement) {
  const router = createMemoryRouter([{ path: routePath, element }], { initialEntries: [path] });
  return renderToStaticMarkup(createElement(RouterProvider, { router }));
}

describe('MyBiz Service OS public demo routes', () => {
  it('renders a provider-disabled in-memory job vertical slice', () => {
    const html = renderAt('/demo/service-os', '/demo/service-os', createElement(ServiceOsDemoPage));
    expect(html).toContain('data-service-os-demo="synthetic"');
    expect(html).toContain('Storage provider disabled');
    expect(html).toContain(`/confirm/${DEMO_CONFIRMATION_TOKEN}`);
    expect(html).toContain('PAYMENT_NOT_REQUESTED');
    expect(html).toContain('provider receipt 없이는 만들지 않습니다.');
    expect(html).toContain('>DRAFT<');
  });

  it('keeps completion, marketing consent and payment visibly separate', () => {
    const html = renderAt(`/confirm/${DEMO_CONFIRMATION_TOKEN}`, '/confirm/:token', createElement(CustomerConfirmationDemoPage));
    expect(html).toContain('data-confirmation-link="synthetic-demo"');
    expect(html).toContain('작업 결과를 확인했습니다.');
    expect(html).toContain('현재 Revision의 사진을 홈페이지 사례로 사용하는 데 동의합니다.');
    expect(html).toContain('PAYMENT_NOT_REQUESTED');
  });

  it('fails closed for an unknown confirmation token', () => {
    const html = renderAt('/confirm/not-valid', '/confirm/:token', createElement(CustomerConfirmationDemoPage));
    expect(html).toContain('data-confirmation-link="invalid"');
    expect(html).not.toContain('완료 확인 체험');
  });

  it('shows only an approved synthetic portfolio projection', () => {
    const approved = renderAt('/site/cleaning-studio', '/site/:slug', createElement(BrandSitePreviewPage));
    const blocked = renderAt('/site/hair-studio', '/site/:slug', createElement(BrandSitePreviewPage));
    expect(approved).toContain('data-portfolio-eligibility="approved"');
    expect(approved).toContain('APPROVED SYNTHETIC CASE');
    expect(blocked).toContain('data-portfolio-eligibility="blocked"');
    expect(blocked).not.toContain('APPROVED SYNTHETIC CASE');
  });
});

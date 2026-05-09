import { useEffect } from 'react';

import { safeImageUrl, sanitizeSeoText } from '@/shared/lib/seo';
import { SERVICE_DESCRIPTION, SITE_NAME } from '@/shared/lib/siteConfig';

export interface PageMetaOptions {
  canonicalUrl?: string;
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown> | null | undefined> | null;
  ogImage?: string;
  ogType?: 'article' | 'website';
  twitterCard?: 'summary' | 'summary_large_image';
}

function ensureMetaDescription() {
  if (typeof document === 'undefined') {
    return null;
  }

  let element = document.querySelector('meta[name="description"]');
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute('name', 'description');
    document.head.appendChild(element);
  }

  return element;
}

function ensureMeta(selector: string, attributes: Record<string, string>) {
  if (typeof document === 'undefined') {
    return null;
  }

  let element = document.querySelector(selector);
  if (!element) {
    element = document.createElement('meta');
    Object.entries(attributes).forEach(([key, value]) => {
      element?.setAttribute(key, value);
    });
    document.head.appendChild(element);
  }

  return element;
}

function ensureCanonicalLink() {
  if (typeof document === 'undefined') {
    return null;
  }

  let element = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', 'canonical');
    document.head.appendChild(element);
  }

  return element;
}

function syncStructuredData(id: string, jsonLd?: PageMetaOptions['jsonLd']) {
  if (typeof document === 'undefined') {
    return;
  }

  const existing = document.querySelector(`script[data-mybiz-jsonld="${id}"]`);
  const values = Array.isArray(jsonLd) ? jsonLd.filter(Boolean) : jsonLd ? [jsonLd] : [];

  if (!values.length) {
    existing?.remove();
    return;
  }

  const script = existing || document.createElement('script');
  script.setAttribute('type', 'application/ld+json');
  script.setAttribute('data-mybiz-jsonld', id);
  script.textContent = JSON.stringify(values.length === 1 ? values[0] : values);

  if (!existing) {
    document.head.appendChild(script);
  }
}

export function useStructuredData(id: string, jsonLd?: PageMetaOptions['jsonLd']) {
  useEffect(() => {
    syncStructuredData(id, jsonLd);
  }, [id, jsonLd]);
}

export function usePageMeta(title: string, description = SERVICE_DESCRIPTION, options?: PageMetaOptions) {
  useEffect(() => {
    const safeTitle = sanitizeSeoText(title, SITE_NAME, 120);
    const safeDescription = sanitizeSeoText(description, SERVICE_DESCRIPTION, 180);
    document.title = `${safeTitle} | ${SITE_NAME}`;
    const descriptionMeta = ensureMetaDescription();
    descriptionMeta?.setAttribute('content', safeDescription);

    if (options?.canonicalUrl) {
      ensureCanonicalLink()?.setAttribute('href', options.canonicalUrl);
    }

    ensureMeta('meta[property="og:title"]', { property: 'og:title' })?.setAttribute('content', safeTitle);
    ensureMeta('meta[property="og:description"]', { property: 'og:description' })?.setAttribute('content', safeDescription);
    ensureMeta('meta[property="og:type"]', { property: 'og:type' })?.setAttribute('content', options?.ogType || 'website');
    ensureMeta('meta[name="twitter:card"]', { name: 'twitter:card' })?.setAttribute('content', options?.twitterCard || 'summary_large_image');
    ensureMeta('meta[name="twitter:title"]', { name: 'twitter:title' })?.setAttribute('content', safeTitle);
    ensureMeta('meta[name="twitter:description"]', { name: 'twitter:description' })?.setAttribute('content', safeDescription);

    const image = safeImageUrl(options?.ogImage);
    if (image) {
      ensureMeta('meta[property="og:image"]', { property: 'og:image' })?.setAttribute('content', image);
      ensureMeta('meta[name="twitter:image"]', { name: 'twitter:image' })?.setAttribute('content', image);
    }

    syncStructuredData('page', options?.jsonLd);
  }, [description, options, title]);
}

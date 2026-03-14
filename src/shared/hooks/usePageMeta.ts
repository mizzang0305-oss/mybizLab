import { useEffect } from 'react';

import { SERVICE_DESCRIPTION, SITE_NAME } from '@/shared/lib/siteConfig';

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

export function usePageMeta(title: string, description = SERVICE_DESCRIPTION) {
  useEffect(() => {
    document.title = `${title} | ${SITE_NAME}`;
    const descriptionMeta = ensureMetaDescription();
    descriptionMeta?.setAttribute('content', description);
  }, [description, title]);
}

function normalizeText(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim() : '';
}

const HANGUL_MOJIBAKE_FRAGMENTS = [
  '怨좉컼',
  '怨듦컻',
  '臾몄',
  '寃곗',
  '硫붾',
  '諛⑸Ц',
  '媛',
  '二쇰',
  '댁쁺',
  '덉빟',
  '⑥씠',
  '곷떞',
  'ㅽ넗',
  '곗씠',
  '뚯뒪',
];

const LATIN1_MOJIBAKE_PATTERN = /(?:Ã.|Â.|ì.|ë.|ê.|í.)/i;

export function countPlaceholderCharacters(value: string) {
  return [...value].filter((character) => character === '?' || character === '\uFFFD').length;
}

export function hasLikelyMojibake(value: string | null | undefined) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return false;
  }

  if (LATIN1_MOJIBAKE_PATTERN.test(normalized)) {
    return true;
  }

  const fragmentHits = HANGUL_MOJIBAKE_FRAGMENTS.filter((fragment) => normalized.includes(fragment)).length;
  if (fragmentHits >= 2) {
    return true;
  }

  return fragmentHits >= 1 && countPlaceholderCharacters(normalized) > 0;
}

export function isBrokenOperationalText(value: string | null | undefined) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return true;
  }

  const compact = normalized.replace(/\s+/g, '');
  const placeholderCount = countPlaceholderCharacters(compact);
  if (placeholderCount >= Math.max(2, Math.ceil(compact.length / 2))) {
    return true;
  }

  return hasLikelyMojibake(normalized);
}


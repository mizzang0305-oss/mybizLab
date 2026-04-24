export function getBusinessTypeLabel(rawValue?: string | null) {
  const normalized = (rawValue || '').trim();
  const raw = normalized.toLowerCase();

  if (!normalized) {
    return '매장';
  }

  if (raw.includes('korean_buffet') || raw.includes('뷔페')) {
    return '한식 뷔페';
  }

  if (raw.includes('izakaya') || raw.includes('이자카야')) {
    return '이자카야';
  }

  if (raw.includes('brunch')) {
    return '브런치 카페';
  }

  if (raw.includes('roastery')) {
    return '카페 로스터리';
  }

  if (raw.includes('coffee') || raw.includes('cafe') || raw.includes('카페')) {
    return '카페';
  }

  if (raw.includes('noodle')) {
    return '면요리 전문점';
  }

  if (raw.includes('salad')) {
    return '샐러드 전문점';
  }

  if (raw.includes('bbq')) {
    return '고깃집';
  }

  return normalized;
}

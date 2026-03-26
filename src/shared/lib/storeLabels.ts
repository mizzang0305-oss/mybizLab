export function getBusinessTypeLabel(rawValue?: string | null) {
  const raw = (rawValue || '').toLowerCase();

  if (!rawValue) {
    return '데모 매장';
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
    return '면요리';
  }

  if (raw.includes('salad')) {
    return '샐러드';
  }

  if (raw.includes('bbq')) {
    return '고깃집';
  }

  return rawValue;
}

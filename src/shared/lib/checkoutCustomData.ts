const ASCII_SAFE_TEXT_PATTERN = /^[\x20-\x7E]*$/;

function sanitizeCheckoutCustomDataString(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return '';
  }

  return ASCII_SAFE_TEXT_PATTERN.test(normalized) ? normalized : encodeURIComponent(normalized);
}

function sanitizeCheckoutCustomDataValue(value: unknown): unknown {
  if (value == null) {
    return null;
  }

  if (typeof value === 'string') {
    return sanitizeCheckoutCustomDataString(value);
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeCheckoutCustomDataValue(item));
  }

  if (typeof value === 'object') {
    return sanitizeCheckoutCustomData(value as Record<string, unknown>);
  }

  return sanitizeCheckoutCustomDataString(String(value));
}

function sanitizeCheckoutCustomDataKey(key: string) {
  return ASCII_SAFE_TEXT_PATTERN.test(key) ? key : encodeURIComponent(key);
}

export function sanitizeCheckoutCustomData(input: Record<string, unknown>) {
  return Object.entries(input).reduce<Record<string, unknown>>((acc, [key, value]) => {
    acc[sanitizeCheckoutCustomDataKey(key)] = sanitizeCheckoutCustomDataValue(value);
    return acc;
  }, {});
}

export function isAsciiSerializableJson(value: unknown) {
  try {
    return ASCII_SAFE_TEXT_PATTERN.test(JSON.stringify(value));
  } catch {
    return false;
  }
}

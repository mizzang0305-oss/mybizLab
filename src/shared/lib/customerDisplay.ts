type CustomerDisplayInput = {
  customer?: {
    customer_id?: string;
    customer_key?: string;
    email?: string;
    id?: string;
    name?: string;
    phone?: string;
  } | null;
  customerId?: string;
  customerKey?: string;
  raw?: {
    customerName?: string;
    email?: string;
    name?: string;
    phone?: string;
  } | null;
};

const GENERIC_NAMES = new Set(['고객', '손님', '방문 고객', 'guest', 'customer']);
const COMMON_MOJIBAKE_PATTERNS = [/怨좉컼/, /誘몃벑/, /二쇰/, /硫붾/, /곌껐/, /�/];

function normalizeDisplayText(value: string | undefined | null) {
  return value?.replace(/\s+/g, ' ').trim() || '';
}

function isGenericCustomerName(value: string) {
  return GENERIC_NAMES.has(value.trim().toLowerCase());
}

export function isBrokenCustomerDisplayText(value: string | undefined | null) {
  const normalized = normalizeDisplayText(value);
  if (!normalized) {
    return true;
  }

  if (COMMON_MOJIBAKE_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return true;
  }

  const compact = normalized.replace(/\s+/g, '');
  const placeholderCount = [...compact].filter((character) => character === '?' || character === '\uFFFD').length;

  return placeholderCount >= Math.max(2, Math.ceil(compact.length / 2));
}

function maskPhone(value: string | undefined | null) {
  const digits = (value || '').replace(/\D/g, '');
  if (digits.length < 7) {
    return '';
  }

  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-***-${digits.slice(-4)}`;
  }

  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}

function maskEmail(value: string | undefined | null) {
  const normalized = normalizeDisplayText(value).toLowerCase();
  const [localPart, domain] = normalized.split('@');
  if (!localPart || !domain) {
    return '';
  }

  return `${localPart[0]}***@${domain}`;
}

function suffixId(value: string | undefined | null) {
  const normalized = normalizeDisplayText(value).replace(/[^a-z0-9]/gi, '');
  if (!normalized) {
    return '';
  }

  return normalized.slice(-6);
}

function resolveMaskedContact(input: CustomerDisplayInput) {
  const phone =
    maskPhone(input.customer?.phone) ||
    maskPhone(input.raw?.phone) ||
    maskPhone(input.customer?.customer_key) ||
    maskPhone(input.customerKey);
  if (phone) {
    return `고객 ${phone}`;
  }

  const email = maskEmail(input.customer?.email) || maskEmail(input.raw?.email);
  if (email) {
    return `고객 ${email}`;
  }

  return '';
}

export function getCustomerDisplayLabel(input: CustomerDisplayInput) {
  const candidateNames = [
    input.customer?.name,
    input.raw?.name,
    input.raw?.customerName,
  ];

  for (const candidate of candidateNames) {
    const name = normalizeDisplayText(candidate);
    if (name && !isGenericCustomerName(name) && !isBrokenCustomerDisplayText(name)) {
      return name;
    }
  }

  const contactLabel = resolveMaskedContact(input);
  if (contactLabel) {
    return contactLabel;
  }

  const customerKeySuffix = suffixId(input.customer?.customer_key || input.customerKey);
  if (customerKeySuffix) {
    return `고객 #${customerKeySuffix}`;
  }

  const customerIdSuffix = suffixId(input.customerId || input.customer?.customer_id || input.customer?.id);
  if (customerIdSuffix) {
    return `고객 #${customerIdSuffix}`;
  }

  return '미등록 고객';
}

type CustomerDisplayInput = {
  customer?: {
    email?: string;
    name?: string;
    phone?: string;
  } | null;
  customerId?: string;
};

export function isBrokenCustomerDisplayText(value: string | undefined | null) {
  const normalized = value?.trim() || '';
  if (!normalized || normalized === '고객') {
    return true;
  }

  const compact = normalized.replace(/\s+/g, '');
  const placeholderCount = [...compact].filter((character) => character === '?' || character === '\uFFFD').length;

  return placeholderCount >= Math.max(2, Math.ceil(compact.length / 2));
}

export function getCustomerDisplayLabel(input: CustomerDisplayInput) {
  const name = input.customer?.name?.trim();
  if (name && !isBrokenCustomerDisplayText(name)) {
    return name;
  }

  const phone = input.customer?.phone?.trim();
  if (phone) {
    return phone;
  }

  const email = input.customer?.email?.trim();
  if (email) {
    return email;
  }

  return input.customerId ? '연결 고객' : '미등록 고객';
}

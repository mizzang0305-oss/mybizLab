import { isBrokenOperationalText } from './brokenText.js';

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

  return isBrokenOperationalText(normalized);
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

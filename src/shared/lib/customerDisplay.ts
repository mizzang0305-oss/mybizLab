type CustomerDisplayInput = {
  customer?: {
    email?: string;
    name?: string;
    phone?: string;
  } | null;
  customerId?: string;
};

export function getCustomerDisplayLabel(input: CustomerDisplayInput) {
  const name = input.customer?.name?.trim();
  if (name && name !== '고객') {
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

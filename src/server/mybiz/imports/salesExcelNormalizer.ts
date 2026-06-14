import { createHash } from 'node:crypto';

import type { SalesExcelColumnRole } from './salesExcelTypes';

const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);
const DAY_MS = 24 * 60 * 60 * 1000;

const HEADER_ALIASES: Record<SalesExcelColumnRole, string[]> = {
  businessId: ['businessid', 'business_id', 'customerid', 'customer_id', '거래처코드', '고객코드', '사업자번호'],
  businessName: ['business', 'businessname', 'customer', 'customername', 'client', 'account', '거래처', '거래처명', '고객', '고객명', '상호', '업체명'],
  itemId: ['itemid', 'item_id', 'categoryid', 'category_id', '상품코드', '품목코드', '메뉴코드'],
  itemName: ['item', 'itemname', 'category', 'menu', 'product', '상품', '상품명', '품목', '품목명', '메뉴', '메뉴명', '분류'],
  orgUnit: ['orgunit', 'org_unit', 'department', 'team', 'part', '부서', '조직', '파트', '팀'],
  outstandingAmount: ['outstanding', 'balance', 'unpaid', '미수', '미수금', '잔액'],
  partNo: ['partno', 'part_no', 'partnumber', '파트번호', '파트no', '파트'],
  quantity: ['quantity', 'qty', 'count', '수량', '건수'],
  receivedAmount: ['received', 'paid', 'payment', 'collection', '입금', '수금', '회입', '회수'],
  revenueAmount: ['revenue', 'sales', 'amount', 'total', 'totalamount', '매출', '매출액', '금액', '합계', '총액'],
  salesDate: ['date', 'salesdate', 'sales_date', 'day', '거래일', '일자', '날짜', '매출일'],
};

export function hashSalesExcelValue(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function shortHash(value: unknown) {
  return hashSalesExcelValue(value).slice(0, 16);
}

export function normalizeLooseText(value: unknown) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value)
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeKeyText(value: unknown) {
  return normalizeLooseText(value).toLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, '');
}

export function normalizeHeader(value: unknown) {
  return normalizeKeyText(value);
}

export function inferColumnRole(value: unknown): SalesExcelColumnRole | null {
  const normalized = normalizeHeader(value);
  if (!normalized) {
    return null;
  }

  for (const [role, aliases] of Object.entries(HEADER_ALIASES) as Array<[SalesExcelColumnRole, string[]]>) {
    if (aliases.some((alias) => normalized === normalizeHeader(alias) || normalized.includes(normalizeHeader(alias)))) {
      return role;
    }
  }

  return null;
}

export function normalizeNumberCell(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const normalized = normalizeLooseText(value);
  if (!normalized) {
    return 0;
  }

  const negative = /^\(.+\)$/.test(normalized) || normalized.startsWith('-');
  const numeric = normalized
    .replace(/[(),]/g, '')
    .replace(/[^\d.-]/g, '');
  const parsed = Number(numeric);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return negative ? -Math.abs(parsed) : parsed;
}

export function normalizeQuantityCell(value: unknown) {
  return Math.trunc(normalizeNumberCell(value));
}

function toDateOnly(date: Date) {
  if (!Number.isFinite(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

export function parseSalesDateCell(value: unknown, options: { fallbackYear?: number } = {}) {
  if (value instanceof Date) {
    return toDateOnly(value);
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value > 20_000) {
      return toDateOnly(new Date(EXCEL_EPOCH_UTC + value * DAY_MS));
    }

    return null;
  }

  const normalized = normalizeLooseText(value);
  if (!normalized) {
    return null;
  }

  const isoLike = normalized.match(/(\d{4})[-./년\s]+(\d{1,2})[-./월\s]+(\d{1,2})/);
  if (isoLike) {
    const [, year, month, day] = isoLike;
    return toDateOnly(new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))));
  }

  const monthDay = normalized.match(/(\d{1,2})[-./월\s]+(\d{1,2})\s*일?/);
  if (monthDay && options.fallbackYear) {
    const [, month, day] = monthDay;
    return toDateOnly(new Date(Date.UTC(options.fallbackYear, Number(month) - 1, Number(day))));
  }

  return null;
}

export function inferPartNoFromFileName(fileName: string) {
  const matched = normalizeLooseText(fileName).match(/(\d+)\s*파트/i);
  return matched ? `${matched[1]}파트` : undefined;
}

export function inferDayRangeHintFromFileName(fileName: string) {
  const matched = normalizeLooseText(fileName).match(/(\d{1,2})\s*~\s*(\d{1,2})\s*일/);
  if (!matched) {
    return null;
  }

  return {
    fromDay: Number(matched[1]),
    toDay: Number(matched[2]),
  };
}

export function buildSalesExcelSyncKey(input: {
  businessKeyHash: string;
  itemKeyHash: string;
  orgUnit?: string;
  partNo?: string;
  rowHash: string;
  salesDate: string;
  storeId: string;
}) {
  return hashSalesExcelValue({
    businessKeyHash: input.businessKeyHash,
    itemKeyHash: input.itemKeyHash,
    orgUnit: input.orgUnit || '',
    partNo: input.partNo || '',
    rowHashFallback: input.businessKeyHash === shortHash('missing-business') && input.itemKeyHash === shortHash('missing-item') ? input.rowHash : '',
    salesDate: input.salesDate,
    storeId: input.storeId,
  });
}

export function buildDateRange(dates: string[]) {
  const sorted = [...new Set(dates)].sort();
  if (!sorted.length) {
    return null;
  }

  return {
    from: sorted[0],
    to: sorted[sorted.length - 1],
  };
}

export function isRecordInDateRange(salesDate: string, range: { from: string; to: string }) {
  return salesDate >= range.from && salesDate <= range.to;
}

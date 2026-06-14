import { parse as parseWorkbook } from 'node-xlsx';

import {
  SALES_EXCEL_SOURCE_TYPE,
  type SalesExcelColumnMapping,
  type SalesExcelColumnRole,
  type SalesExcelParsedRecord,
  type SalesExcelParseResult,
  type SalesExcelRejectedRow,
} from './salesExcelTypes';
import {
  buildDateRange,
  buildSalesExcelSyncKey,
  hashSalesExcelValue,
  inferColumnRole,
  inferDayRangeHintFromFileName,
  inferPartNoFromFileName,
  normalizeKeyText,
  normalizeLooseText,
  normalizeNumberCell,
  normalizeQuantityCell,
  parseSalesDateCell,
  shortHash,
} from './salesExcelNormalizer';

type CellValue = boolean | Date | number | string | null | undefined;
type SheetRow = CellValue[];

export interface ParseSalesExcelWorkbookInput {
  buffer: ArrayBuffer | Buffer | Uint8Array;
  fallbackYear?: number;
  fileName: string;
  storeId: string;
}

const REQUIRED_SIGNAL_ROLES = new Set<SalesExcelColumnRole>(['businessName', 'revenueAmount', 'salesDate']);
const AMOUNT_ROLES: SalesExcelColumnRole[] = ['revenueAmount', 'receivedAmount', 'outstandingAmount', 'quantity'];

function toBuffer(buffer: ArrayBuffer | Buffer | Uint8Array) {
  if (Buffer.isBuffer(buffer)) {
    return buffer;
  }

  if (buffer instanceof Uint8Array) {
    return Buffer.from(buffer);
  }

  return Buffer.from(buffer);
}

function isBlankCell(value: unknown) {
  return normalizeLooseText(value) === '';
}

function isBlankRow(row: SheetRow) {
  return row.every(isBlankCell);
}

function collectColumnsPresent(row: SheetRow) {
  return row.map((value, index) => (isBlankCell(value) ? '' : `c${index + 1}`)).filter(Boolean);
}

function readCell(row: SheetRow, mapping: Partial<Record<SalesExcelColumnRole, number>>, role: SalesExcelColumnRole) {
  const index = mapping[role];
  return typeof index === 'number' ? row[index] : undefined;
}

function findHeaderMapping(sheetName: string, rows: SheetRow[]): SalesExcelColumnMapping | null {
  for (let index = 0; index < Math.min(rows.length, 25); index += 1) {
    const roles: Partial<Record<SalesExcelColumnRole, number>> = {};
    const row = rows[index];

    row.forEach((cell, cellIndex) => {
      const role = inferColumnRole(cell);
      if (role && roles[role] === undefined) {
        roles[role] = cellIndex;
      }
    });

    const roleSet = new Set(Object.keys(roles) as SalesExcelColumnRole[]);
    const signalCount = [...REQUIRED_SIGNAL_ROLES].filter((role) => roleSet.has(role)).length;
    const hasAmount = AMOUNT_ROLES.some((role) => roleSet.has(role));

    if (signalCount >= 2 && hasAmount) {
      return {
        headerRowNumber: index + 1,
        roles,
        sheetName,
      };
    }
  }

  return null;
}

function getRecordId(syncKey: string) {
  return `sales_import_${syncKey.slice(0, 24)}`;
}

function createRejectedRow(input: {
  reason: string;
  row: SheetRow;
  rowNumber: number;
  sheetName: string;
}): SalesExcelRejectedRow {
  return {
    columnsPresent: collectColumnsPresent(input.row),
    rawHash: shortHash(input.row.map((cell) => normalizeLooseText(cell))),
    reason: input.reason,
    rowNumber: input.rowNumber,
    sheetName: input.sheetName,
  };
}

function buildParsedRecord(input: {
  fileOrgUnitHint?: string;
  mapping: SalesExcelColumnMapping;
  row: SheetRow;
  rowNumber: number;
  salesDate: string;
  storeId: string;
}): SalesExcelParsedRecord | SalesExcelRejectedRow {
  const { fileOrgUnitHint, mapping, row, rowNumber, salesDate, storeId } = input;
  const businessId = normalizeLooseText(readCell(row, mapping.roles, 'businessId'));
  const businessName = normalizeLooseText(readCell(row, mapping.roles, 'businessName'));
  const itemId = normalizeLooseText(readCell(row, mapping.roles, 'itemId'));
  const itemName = normalizeLooseText(readCell(row, mapping.roles, 'itemName'));
  const orgUnit = normalizeLooseText(readCell(row, mapping.roles, 'orgUnit')) || fileOrgUnitHint;
  const partNo = normalizeLooseText(readCell(row, mapping.roles, 'partNo')) || fileOrgUnitHint;
  const revenueAmount = normalizeNumberCell(readCell(row, mapping.roles, 'revenueAmount'));
  const receivedAmount = normalizeNumberCell(readCell(row, mapping.roles, 'receivedAmount'));
  const outstandingAmount = normalizeNumberCell(readCell(row, mapping.roles, 'outstandingAmount'));
  const quantity = normalizeQuantityCell(readCell(row, mapping.roles, 'quantity'));
  const hasBusinessSignal = Boolean(businessId || businessName);
  const hasItemSignal = Boolean(itemId || itemName);
  const hasAmountSignal = [revenueAmount, receivedAmount, outstandingAmount, quantity].some((value) => value !== 0);

  if (!hasBusinessSignal && !hasItemSignal) {
    return createRejectedRow({
      reason: 'MISSING_BUSINESS_AND_ITEM_KEY',
      row,
      rowNumber,
      sheetName: mapping.sheetName,
    });
  }

  if (!hasAmountSignal) {
    return createRejectedRow({
      reason: 'MISSING_AMOUNT_SIGNAL',
      row,
      rowNumber,
      sheetName: mapping.sheetName,
    });
  }

  const businessKeyHash = hasBusinessSignal
    ? shortHash({ businessId: normalizeKeyText(businessId), businessName: normalizeKeyText(businessName) })
    : shortHash('missing-business');
  const itemKeyHash = hasItemSignal
    ? shortHash({ itemId: normalizeKeyText(itemId), itemName: normalizeKeyText(itemName) })
    : shortHash('missing-item');
  const amountHash = shortHash({ outstandingAmount, quantity, receivedAmount, revenueAmount });
  const rowHash = hashSalesExcelValue({
    amountHash,
    businessKeyHash,
    itemKeyHash,
    orgUnit: normalizeKeyText(orgUnit),
    partNo: normalizeKeyText(partNo),
    salesDate,
  });
  const syncKey = buildSalesExcelSyncKey({
    businessKeyHash,
    itemKeyHash,
    orgUnit,
    partNo,
    rowHash,
    salesDate,
    storeId,
  });

  return {
    businessKeyHash,
    isDeleted: false,
    itemKeyHash,
    metadata: {
      amountHash,
      hasBusinessId: Boolean(businessId),
      hasBusinessName: Boolean(businessName),
      hasItemId: Boolean(itemId),
      hasItemName: Boolean(itemName),
      sourceRowNumber: rowNumber,
    },
    orgUnit: orgUnit || undefined,
    outstandingAmount,
    partNo: partNo || undefined,
    quantity,
    receivedAmount,
    recordId: getRecordId(syncKey),
    revenueAmount,
    rowHash,
    rowNumber,
    salesDate,
    sheetName: mapping.sheetName,
    sourceType: SALES_EXCEL_SOURCE_TYPE,
    storeId,
    syncKey,
    version: 1,
  };
}

export function parseSalesExcelWorkbook(input: ParseSalesExcelWorkbookInput): SalesExcelParseResult {
  const workbook = parseWorkbook<SheetRow>(toBuffer(input.buffer), {
    cellDates: true,
    raw: false,
  });
  const fileOrgUnitHint = inferPartNoFromFileName(input.fileName);
  const dayRangeHint = inferDayRangeHintFromFileName(input.fileName);
  const records: SalesExcelParsedRecord[] = [];
  const rejectedRows: SalesExcelRejectedRow[] = [];
  const columnMappings: SalesExcelColumnMapping[] = [];
  const warnings: string[] = [];
  const seenSyncKeys = new Set<string>();

  workbook.forEach((sheet) => {
    const rows = (sheet.data || []).filter((row) => Array.isArray(row)) as SheetRow[];
    const mapping = findHeaderMapping(sheet.name, rows);

    if (!mapping) {
      if (rows.some((row) => !isBlankRow(row))) {
        warnings.push(`NO_HEADER_MAPPING:${sheet.name}`);
      }
      return;
    }

    columnMappings.push(mapping);
    let lastParsedDate: string | null = null;

    rows.slice(mapping.headerRowNumber).forEach((row, offset) => {
      const rowNumber = mapping.headerRowNumber + offset + 1;
      if (isBlankRow(row)) {
        return;
      }

      const rawDateCell = readCell(row, mapping.roles, 'salesDate');
      const parsedDate = parseSalesDateCell(rawDateCell, {
        fallbackYear: input.fallbackYear,
      }) || (isBlankCell(rawDateCell) ? lastParsedDate : null);

      if (!parsedDate) {
        rejectedRows.push(
          createRejectedRow({
            reason: 'UNPARSEABLE_SALES_DATE',
            row,
            rowNumber,
            sheetName: sheet.name,
          }),
        );
        return;
      }

      lastParsedDate = parsedDate;

      const parsedRecord = buildParsedRecord({
        fileOrgUnitHint,
        mapping,
        row,
        rowNumber,
        salesDate: parsedDate,
        storeId: input.storeId,
      });

      if ('reason' in parsedRecord) {
        rejectedRows.push(parsedRecord);
        return;
      }

      if (seenSyncKeys.has(parsedRecord.syncKey)) {
        rejectedRows.push(
          createRejectedRow({
            reason: 'DUPLICATE_SYNC_KEY',
            row,
            rowNumber,
            sheetName: sheet.name,
          }),
        );
        return;
      }

      seenSyncKeys.add(parsedRecord.syncKey);
      records.push(parsedRecord);
    });
  });

  if (!records.length && dayRangeHint) {
    warnings.push(`FILENAME_DAY_RANGE_HINT_ONLY:${dayRangeHint.fromDay}-${dayRangeHint.toDay}`);
  }

  if (fileOrgUnitHint && !records.some((record) => record.orgUnit || record.partNo)) {
    warnings.push(`FILENAME_ORG_UNIT_HINT_ONLY:${fileOrgUnitHint}`);
  }

  const dateRange = buildDateRange(records.map((record) => record.salesDate));
  const requiresDateConfirmation = !dateRange || rejectedRows.some((row) => row.reason === 'UNPARSEABLE_SALES_DATE');
  const checksum = hashSalesExcelValue({
    fileName: input.fileName,
    records: records.map((record) => record.rowHash).sort(),
    rejected: rejectedRows.map((row) => row.rawHash).sort(),
    storeId: input.storeId,
  });

  return {
    checksum,
    columnMappings,
    dateRange,
    fileName: input.fileName,
    orgUnit: records.find((record) => record.orgUnit)?.orgUnit || fileOrgUnitHint,
    partNo: records.find((record) => record.partNo)?.partNo || fileOrgUnitHint,
    records: records.map((record) => ({ ...record, sourceChecksum: checksum })),
    rejectedRows,
    requiresDateConfirmation,
    sheetCount: workbook.length,
    warnings,
  };
}

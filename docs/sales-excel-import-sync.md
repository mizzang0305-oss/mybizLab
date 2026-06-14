# Sales Excel Import Sync

## Intent

This feature adds a store-scoped Excel sales import workflow:

- parse `.xls` / `.xlsx` uploads
- build a sanitized preview
- compare uploaded rows with existing store-scoped import records
- calculate insert, update, soft-delete, unchanged, and rejected counts
- keep production apply disabled until a separate approval enables the write gates

The Excel file itself must never be committed. Raw customer or business row values must not be logged or returned by API responses.

## Scope

Default sync scope:

- `store_id`
- parsed `sales_date` range
- optional `org_unit` / `part_no`
- `source_type = excel_sales_import`

For filenames such as `11파트 1~6일 매출현황.XLS`, the parser treats `11파트` as an org/part hint. Date range still comes from workbook content. If the workbook cannot provide a full date, the filename day range is only a warning and requires operator confirmation.

## Identity Key

The sync key is not based on row index. It is built from:

1. `store_id + sales_date + hashed business identifier + hashed item/category identifier`
2. fallback hashed normalized business/item text
3. final row hash only when both business and item identifiers are unavailable

The implementation stores and returns hashes plus sanitized metadata only.

## Preview

`POST /api/admin/imports/sales-excel/preview`

JSON body:

```json
{
  "storeId": "store_uuid",
  "fileName": "11파트 1~6일 매출현황.XLS",
  "fileBase64": "data:application/vnd.ms-excel;base64,..."
}
```

Preview is read-only. It returns:

- `insertCount`
- `updateCount`
- `deleteCount` as soft-delete candidates
- `unchangedCount`
- `rejectedCount`
- `dateRange`
- `orgUnit` / `partNo`
- `checksum`
- sanitized warnings

## Apply

`POST /api/admin/imports/sales-excel/apply`

Apply requires all of the following:

- `broadDbWriteEnabled = true`
- `salesExcelImportApplyEnabled = true`
- exact approval phrase `APPLY_SALES_EXCEL_SYNC`
- server-side store membership authorization
- preview checksum still matches

Current defaults keep production apply blocked. Local tests use the in-memory repository to prove insert, update, and soft-delete behavior.

## API Authorization

The API uses server-side Supabase auth validation and canonical store membership resolution. Browser local state is not treated as permission truth. Missing token returns `401`; missing store access returns `403`.

## DB Migration

Migration file:

- `supabase/migrations/20260614132205_sales_excel_import_sync.sql`

It defines:

- `sales_import_batches`
- `sales_import_rows`
- `sales_daily_import_records`
- `sales_import_sync_results`

The migration is authored only. This PR does not run `supabase db push`, `supabase migration up`, or `supabase migration repair`.

## Forbidden Commands

Do not run:

- `npx supabase migration repair ...`
- `npx supabase db push`
- `npx supabase migration up`
- SQL migration body replay
- RLS policy apply outside the reviewed migration path
- GRANT or REVOKE
- live lead write
- live customer memory write
- hard delete
- production sales row writes

## Rollback

Source rollback is a normal git revert of this PR. Since no production migration/apply/write is executed by this PR, there is no production DB rollback.

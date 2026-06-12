# Enterprise Data Import Runbook

This runbook explains how Acme handles enterprise data imports for onboarding, migration, support
recovery, and bulk updates. It is intended for support engineers, data operations specialists, and
customer success managers.

## Supported Objects

The import system supports customers, users, teams, products, catalogs, orders, invoices,
subscriptions, entitlements, and historical usage events. Import requests outside these objects must
be reviewed by data operations before support promises a timeline.

The import portal accepts CSV, JSON, ZIP archives, and supporting PDF documents. ZIP archives may
contain multiple CSV files if a manifest file maps each file to an object type. PDFs are accepted as
evidence but are not parsed into structured records unless document extraction is enabled.

## File Requirements

CSV files must use UTF-8 encoding, include a header row, and use comma delimiters. Date fields must
use ISO 8601 format. Currency values must include currency code when the customer has multi-currency
enabled. Boolean values must use `true` or `false`.

JSON files must include a top-level `records` array. Each record must include `external_id`,
`object_type`, and `updated_at`. Nested arrays are allowed for entitlement and subscription items,
but deeply nested objects should be flattened before import.

Files larger than 100 MB must use the secure import portal. Files larger than 1 GB require a staged
import plan and approval from data operations.

## Preflight Validation

Preflight validation checks required fields, duplicate external IDs, invalid dates, malformed email
addresses, unsupported currencies, missing customer IDs, invalid plan names, and referential
integrity between objects. Preflight does not write production data.

A preflight report must be shared with the customer for imports that affect invoices,
subscriptions, or entitlements. The customer must approve the report before production import.

## Import Execution

Standard imports are executed during the customer's approved maintenance window. Strategic customers
may request supervised imports with a data operations engineer present. Support should not start a
production import if there is an active P0 incident affecting the import system.

Each production import must record the source file name, source checksum, customer ID, operator,
object count, started time, completed time, and rollback strategy. Imports that modify billing
objects must also record finance operations approval.

## Failure Handling

Failed imports must create a support ticket containing customer ID, file name, checksum, error code,
error message, row number when available, object type, timestamp, operator, and whether production
data was modified. P0 priority is used only when the failure blocks a live customer launch or causes
customer-visible data corruption.

If the import partially succeeds, data operations must classify the failure as retryable,
manual-fix, rollback-required, or engineering-required. Retryable failures may be retried once after
fixing the input file. Rollback-required failures must not be retried until rollback completes.

## Rollback

Rollback plans are required for imports that update more than 10,000 records, modify billing data,
or change entitlements. A rollback plan must include the restore source, expected duration, customer
impact, validation query, and communications owner.

If rollback exceeds the maintenance window, the incident commander decides whether to continue,
pause, or downgrade the import. Customer success must send an update before the maintenance window
ends.

## Customer Communication

Support should tell customers what was imported, what was skipped, what failed, and what action is
needed. Do not send raw stack traces to customers. Use the preflight report and import summary
instead.

When asking customers to fix files, include the exact column, row, expected value format, and a
small corrected example. Avoid vague guidance such as "please clean your file."

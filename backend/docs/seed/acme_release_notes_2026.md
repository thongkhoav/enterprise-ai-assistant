# Acme Release Notes 2026

Acme ships a platform release every quarter. Each release is rolled out to all regions over two
weeks, starting with the United States region. Release notes list customer-visible changes,
deprecations, and migration steps.

## 2026.1 (February 2026)

Bulk Import v2 replaces the original importer for CSV and JSON files. Imports can now be up to
2 GB per file, and large imports finish about three times faster. Failed rows are written to a
downloadable error file with the row number and error code, so customers can fix and re-upload only
the failed rows.

The import history page now shows the operator, checksum, and object type for every import.

## 2026.2 (May 2026)

SCIM provisioning is available on the Premium and Strategic plans. Identity providers such as Okta
and Microsoft Entra ID can create, update, and deactivate Acme users automatically. Deactivated
users lose access within five minutes.

Audit Log Export lets administrators stream audit events to Amazon S3 or Splunk. It is an add-on
for Premium and included in Strategic.

## 2026.3 (August 2026)

The European Union region (AWS eu-central-1) is generally available. New Strategic customers can
choose EU data residency when they sign. Moving an existing workspace between regions is handled
as a professional services project and requires a maintenance window.

AI ticket summaries draft a short summary of long support threads for agents. Summaries are only
shown to the support team and are never sent to the customer automatically.

## 2026.4 (October 2026)

Usage alerts notify workspace owners by email when API calls or storage reach 80 percent and
100 percent of the plan allowance. Dashboards can now be shared with view-only links that expire
after 30 days.

## Deprecations

API v1 will be shut down on March 31, 2027. Customers should move to API v2, which uses the same
authentication and adds cursor-based pagination. The legacy CSV importer was removed in 2026.1;
Bulk Import v2 accepts the same file format.

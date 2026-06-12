# Product Analytics Catalog

This catalog defines common product and operations metrics used by Acme teams. It helps the
assistant answer analytics questions consistently and distinguish documented metrics from fake
database tool responses.

## Core Usage Metrics

Weekly active users counts unique users who performed a tracked product action during a calendar
week. Monthly active users counts unique users in a calendar month. Activated accounts are accounts
that completed workspace provisioning, invited at least one administrator, and ran one successful
workflow.

Feature adoption is measured by accounts using a feature at least twice in a 30-day period. One-time
usage during onboarding does not count as adoption. Pilot usage should be separated from production
usage when reporting strategic account health.

## Import Metrics

Import success rate is successful import jobs divided by total completed import jobs. Canceled jobs
are excluded. Import retry rate is retry jobs divided by failed jobs. Import latency is measured
from job accepted time to job completed time.

The data operations team reviews import success rate daily. A success rate below 95 percent for
strategic customers triggers investigation. A failure spike above 5 percent for 10 minutes triggers
an alert.

## Support Metrics

First response time measures time from ticket creation to first human response. Time to resolution
measures time from ticket creation to resolved status. Reopen rate measures resolved tickets reopened
within seven days. Escalation rate measures tickets transferred from support to engineering,
security, finance, data operations, or legal operations.

P0 and P1 tickets are excluded from normal first response reporting and tracked through incident
metrics instead.

## Reliability Metrics

API availability is measured from successful health checks and customer-facing API responses.
Latency is reported at p50, p90, p95, and p99. Background job health is measured by queue depth,
oldest job age, success rate, and dead-letter count.

Reliability dashboards should segment by region, plan level, and customer tier when possible.
Aggregate metrics can hide strategic customer impact.

## Billing Metrics

Monthly recurring revenue is recognized revenue from active subscriptions in the month. Net revenue
retention includes expansion, contraction, churn, and reactivation. Refund impact is tracked by
refund amount, refund reason, plan tier, and whether the refund is linked to an incident.

Billing metrics used in executive updates must come from finance-approved reports. Product telemetry
may explain usage, but it is not the source of truth for recognized revenue.

## Data Quality

Metrics should include source system, refresh cadence, owner, known caveats, and last updated time.
If a metric is stale, the assistant should mention the stale timestamp and avoid presenting it as
current.

When metric definitions conflict, finance-approved definitions override product analytics for
revenue, security-approved definitions override product analytics for access events, and incident
commander definitions override product analytics during active incidents.

# Acme Enterprise Support Policy

Acme provides enterprise support for customers on the Premium and Strategic plans. This policy is
used by support engineers, customer success managers, escalation leads, and product operations teams
when handling enterprise customer requests. The goal is to make support responses consistent,
auditable, and easy to connect with account context, product telemetry, and incident workflows.

## Plan Coverage

Premium customers receive business-hours support, priority ticket routing, and access to the secure
import portal. Strategic customers receive a named customer success manager, quarterly business
reviews, expedited refund handling, and incident communication support during high-severity events.
Trial accounts are not eligible for enterprise support unless an account executive attaches a
pre-sales evaluation note to the customer record.

Support agents should verify plan level before promising an SLA. If the account plan is missing or
out of sync, the agent should ask revenue operations to refresh the customer record before quoting a
commitment.

## Refund SLA

Refund requests must be acknowledged within 24 business hours. Standard refund processing takes
5 to 10 business days after approval. Strategic customers may request expedited handling through
their customer success manager.

Refund requests must include the invoice ID, customer ID, billing contact, purchase date, refund
reason, and whether the customer is requesting a full or partial refund. Refunds above 10,000 USD
require finance director approval. Refunds linked to a product incident should reference the
incident ID so finance can report impact by root cause.

If a refund is denied, the support agent must provide a clear reason and link to the relevant
contract clause or billing term. Customers should not be told that a refund is "impossible"; the
approved language is "not eligible under the current agreement" followed by the escalation path.

## Support Ticket Priorities

P0 tickets are reserved for production outages, data loss, security incidents, or failed enterprise
imports that block a live customer launch. P1 tickets include severe degradation, repeated import
failures, customer-visible billing errors, and access-control issues affecting multiple users. P2
tickets include individual account issues, configuration questions, and non-blocking integration
problems. P3 tickets include feature requests, how-to questions, and cosmetic defects.

Every ticket must include customer ID, plan level, environment, impact statement, requested outcome,
and the latest known timestamp. P0 and P1 tickets must include an owner and next update time before
they are assigned to engineering.

## Data Import

Enterprise data imports support CSV, JSON, and PDF attachments. Files larger than 100 MB should be
uploaded through the secure import portal. Failed imports must create a support ticket with the
original file name, error message, customer ID, and timestamp.

The import team supports customer, order, invoice, subscription, and catalog objects. CSV imports
must use UTF-8 encoding and include a header row. JSON imports must include a top-level `records`
array. PDF attachments are accepted only as supporting evidence and are not parsed as structured
records unless the customer has the document extraction add-on.

If the import contains personally identifiable information, support must confirm that the customer
uploaded through the secure portal and not through email. Files sent through email must be deleted
from the ticket thread and the customer should be redirected to the portal.

## Access Control

Production data access requires manager approval, a ticket reference, and a time-bound access
window. Shared accounts are not allowed.

Access requests must specify the system, dataset, reason, customer ID, approver, and expiration
time. Default access windows are 4 hours for support, 8 hours for engineering, and 24 hours for
incident commanders. Any extension must be documented in the original ticket.

Support agents may view customer metadata, plan level, and non-sensitive telemetry. They may not
view raw payment details, authentication secrets, private API keys, or customer-uploaded documents
unless the ticket explicitly requires it and approval is recorded.

## Incident Response

Critical incidents must be triaged within 15 minutes. A customer-facing update should be sent every
60 minutes until the incident is resolved or downgraded.

Incident status pages should use plain language and avoid speculative root cause statements.
Internal notes may include hypotheses, but public updates should focus on impact, mitigation,
customer action required, and the next update time. Post-incident reviews are required for every P0
and any P1 lasting longer than four hours.

## Communication Standards

Support responses should be concise, specific, and evidence-based. When referencing policy, include
the policy name and the operational reason behind the decision. If the answer depends on missing
data, state exactly what is missing and who should provide it.

Customer-facing updates should not expose internal tool names, employee names beyond approved
contacts, database table names, or vendor incident IDs. Internal handoff notes may include those
details if they help engineering reproduce the issue.

## Escalation Paths

Billing issues escalate to finance operations. Security questions escalate to the security duty
officer. Import failures escalate to data operations. Contract questions escalate to legal
operations. Repeated SLA misses escalate to the support operations manager and the account owner.

An escalation is considered complete only when the receiving team accepts ownership in the ticket or
provides an explicit rejection reason.

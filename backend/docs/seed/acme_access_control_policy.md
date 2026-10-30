# Acme Access Control Policy

This policy defines how Acme teams request, approve, monitor, and revoke access to enterprise
customer systems. It applies to support, engineering, customer success, finance operations, data
operations, and any contractor who may interact with production data.

## Access Principles

Access must be least-privilege, time-bound, attributable to a named person, and tied to a business
reason. Shared accounts, reused credentials, and permanent emergency access are not allowed. All
production access must map to a ticket, incident, approved maintenance window, or customer-authorized
support request.

The default answer to broad access requests is no. The requester should narrow the system, customer,
dataset, action, and time window. Access approvers should verify that read-only access is sufficient
before approving write access.

## Access Request Fields

Every access request must include requester, manager, customer ID, system name, dataset name, access
level, business justification, ticket ID, start time, expiration time, and rollback owner. Requests
missing customer ID or expiration time should be returned to the requester.

Emergency requests may start before manager approval only during a P0 incident. The incident
commander must approve the request, and manager approval must be attached within one business day.

## Permission Levels

Viewer access allows read-only inspection of metadata, logs, and non-sensitive telemetry. Operator
access allows controlled workflow execution such as retrying an import job, refreshing an account
cache, or resending a webhook. Maintainer access allows configuration changes and must include a
rollback plan. Admin access is restricted to platform owners and requires security review.

Support agents may receive viewer or operator access. Customer success managers may receive viewer
access for account health dashboards. Engineering may receive maintainer access for scoped systems
during incident response or approved maintenance.

## Sensitive Data Rules

Payment data, authentication secrets, private API keys, customer-uploaded documents, personal
identifiers, and raw database exports are sensitive data. Sensitive data must not be copied into
chat, screenshots, public issue trackers, or external documents. If sensitive data is required for a
ticket, attach it only through the secure evidence vault.

Logs shared with customers must be redacted. Redaction must remove tokens, email addresses when not
necessary, phone numbers, full names, IP addresses unless required for diagnosis, and internal host
names.

## Approval Matrix

Support viewer access requires manager approval. Support operator access requires manager approval
and system owner approval. Engineering maintainer access requires engineering manager approval.
Admin access requires security duty officer approval and platform owner approval. Production write
access during business-as-usual work requires a change request.

If the requester and approver are the same person, the request must be reassigned to the manager's
manager or the security duty officer.

## Monitoring And Revocation

Access grants should be reviewed every hour during P0 incidents and every four hours during P1
incidents. Normal support access expires automatically at the end of the approved window. If
automatic revocation fails, the system owner must revoke manually and comment on the ticket.

After a ticket closes, access should be revoked within 30 minutes. A daily report lists expired
access grants, grants without ticket IDs, and grants with failed revocation events.

## Audit Expectations

Audit logs must answer who accessed what, when, from where, why, and what action was taken. Audit
records must be retained for at least 400 days. Security reviews sample access requests weekly and
all P0 emergency grants monthly.

Any access without a valid business reason is treated as a security incident. The security duty
officer must open an incident ticket, freeze the account if necessary, and notify legal operations
if customer data exposure is suspected.

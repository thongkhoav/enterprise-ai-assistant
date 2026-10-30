# Incident Response Runbook

This runbook defines how Acme detects, triages, communicates, mitigates, and reviews incidents for
enterprise customers. It is designed for incident commanders, support leads, engineering owners,
customer success managers, and executive stakeholders.

## Severity Levels

P0 incidents include total production outage, confirmed customer data loss, active security breach,
or billing system corruption affecting multiple enterprise customers. P1 incidents include severe
degradation, repeated failed imports for a strategic customer, incorrect entitlement enforcement,
or major API latency above agreed SLA. P2 incidents include isolated customer impact, delayed
background jobs, or degraded non-critical workflows. P3 incidents are minor defects or questions
that do not require incident command.

The initial severity may be changed as evidence improves. Downgrades require incident commander
approval. Upgrades may be initiated by support, engineering, customer success, or security.

## Triage Timeline

P0 incidents must be triaged within 15 minutes. P1 incidents must be triaged within 30 minutes.
P2 incidents must receive an owner within four business hours. Triage means assigning incident
commander, identifying impacted services, creating a communication channel, and naming the first
technical owner.

During triage, the team should identify customer impact, affected regions, start time, detection
source, current mitigation, and whether customer action is required.

## Roles

The incident commander owns coordination, severity, timeline, and next update time. The technical
lead owns diagnosis, mitigation, and recovery validation. The support lead owns customer questions
and ticket routing. The communications owner writes internal and external updates. The scribe records
decisions, timestamps, and evidence.

For security incidents, the security duty officer becomes mandatory approver for customer-facing
language. For billing incidents, finance operations must join before sending refund or credit
commitments.

## Customer Updates

Customer-facing updates should be sent every 60 minutes for P0 and every 120 minutes for P1 unless
the incident commander sets a shorter interval. Updates must include impact, current status,
mitigation progress, next update time, and any customer action required.

Do not include speculative root cause, internal service names, vendor incident IDs, employee names
other than approved contacts, or raw logs. If root cause is not confirmed, say "investigation is in
progress."

## Mitigation And Recovery

Mitigation reduces customer impact before root cause is fully fixed. Recovery confirms the system is
operating normally again. A mitigation may include rollback, traffic shift, feature flag disablement,
queue pause, retry job, or temporary manual process.

Recovery validation must use objective signals such as error rate, latency, job success rate, import
completion rate, billing reconciliation count, or customer confirmation. An incident is not resolved
only because an alert stopped firing.

## Post-Incident Review

Every P0 and any P1 lasting longer than four hours requires a post-incident review. The review must
include timeline, detection gap, customer impact, root cause, contributing factors, what worked, what
failed, corrective actions, owners, and due dates.

Corrective actions should be specific and verifiable. "Improve monitoring" is not acceptable.
"Add an alert when import failure rate exceeds 5 percent for 10 minutes" is acceptable.

## Incident Metrics

Operations tracks time to detect, time to acknowledge, time to mitigate, time to recover, number of
impacted customers, number of customer-visible updates, number of reopened incidents, and overdue
corrective actions. These metrics are reviewed monthly by engineering leadership and support
operations.

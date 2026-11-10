# AI Support Desk & SLA Incident Manager

An AI-assisted support operations workflow that classifies incoming support emails, maintains ticket state in an operational database, tracks calendar-hour service-level agreements (SLAs), and escalates overdue incidents.

> **Project status:** Core intake, existing-ticket update, first-response capture, and SLA breach-state logic have passed controlled tests. The SLA monitor has also passed paused/resolved negative-control checks. New-ticket creation through a fresh real email, resolution lifecycle, and independent Slack-delivery verification remain outstanding. All scenarios are kept inactive outside controlled tests; this is a portfolio prototype, not a production service.

## 1. Business problem

Support teams need to do more than read and answer incoming emails. They must identify what each issue is about, assess urgency, maintain a reliable ticket history, meet response and resolution commitments, and escalate overdue work without sending duplicate alerts.

When ticket information is spread across inboxes and spreadsheets, teams can lose track of ownership, deadlines, and the latest status.

## 2. Proposed solution

The system uses AI to structure incoming support requests and Make.com to coordinate ticket processing. A Make Data Store acts as the operational source of truth. Separate scenarios handle intake, SLA monitoring, and response/resolution lifecycle events.

### High-level architecture

```mermaid
flowchart TD
    A[Support email inbox] --> B[Incoming Ticket Intake]
    B --> C[Gemini AI classification]
    C --> D[Parse structured JSON]
    D --> E{Ticket already exists?}
    E -->|Yes| F[Update existing ticket]
    E -->|No| G[Create ticket + calculate SLA deadlines]
    F --> H[(Make Data Store)]
    G --> H
    H --> I[SLA Monitoring]
    I --> J{Deadline breached?}
    J -->|First response| K[Escalation alert + state update]
    J -->|Resolution| L[Escalation alert + state update]
    H --> M[Response & Resolution Lifecycle]
    M --> N[Record first response / resolution events]
    H --> O[Google Sheets reporting - planned]
```

## 3. Scenario responsibilities

| Scenario | Responsibility | Current state |
|---|---|---|
| AI Support Desk & SLA Incident Manager | Watch new support emails, classify them with Gemini, search by ticket ID, then update or create a ticket | Existing-ticket update path tested; new-ticket create path still pending |
| AI Support Desk — SLA Monitoring & Escalations | Search unresolved tickets, evaluate first-response and resolution deadlines independently, send escalation alerts, and update ticket state | Breach and negative-control state tests passed; Slack delivery not independently verified |
| AI Support Desk — Response & Resolution Lifecycle | Observe sent support replies and update the matching ticket's first-response timestamp and SLA result | First-response capture tested against a real sent reply; resolution path pending |

## 4. Ticket lifecycle

1. A new support email arrives in the dedicated support inbox.
2. Gemini classifies the request and returns structured fields such as category, priority, sentiment, summary, and assigned team.
3. Make parses the structured response.
4. The workflow searches the Data Store for the ticket associated with the Gmail thread.
5. If a matching ticket exists, it updates the existing record without resetting the original SLA clock. Otherwise, it creates a new ticket and calculates its deadlines.
6. The SLA monitor periodically checks unresolved tickets.
7. When a deadline is breached, the relevant escalation path sends an internal alert and updates the ticket's SLA status and escalation metadata.
8. The response/resolution lifecycle scenario records the first human response; resolution event handling remains to be completed. Customer replies are not sent automatically by this prototype.

## 5. SLA policy

SLAs use **calendar hours**, not business hours. Deadlines therefore continue through nights, weekends, and holidays.

| Priority | First response target | Resolution target |
|---|---:|---:|
| P1 — Critical | 1 hour | 4 hours |
| P2 — High | 4 hours | 12 hours |
| P3 — Normal | 8 hours | 24 hours |
| P4 — Low | 24 hours | 72 hours |

**Example:** A P1 ticket created at 10:00 has a first-response deadline of 11:00 and a resolution deadline of 14:00, using the same local timezone.

The monitor is configured to run every **15 minutes**, the minimum interval available on the current Make plan. This means a breach alert may be delayed until the next scheduled check; the monitor is not real-time.

## 6. Operational data model

The Make Data Store named `AI Support Desk — Ticket Database` is the operational database. Its records use the strict `Support Ticket Record` data structure.

The schema contains 31 fields, grouped by purpose:

| Field group | Fields |
|---|---|
| Identity and source | `ticket_id`, `source`, `source_event_id`, `last_source_event_id` |
| Customer and request | `customer_name`, `customer_email`, `subject`, `description` |
| AI classification | `category`, `priority`, `sentiment`, `ai_summary`, `assigned_team` |
| Ticket state | `ticket_status`, `internal_notes`, `created_by`, `created_at`, `updated_at` |
| First-response SLA | `first_response_target_hours`, `first_response_sla_status`, `first_response_due_at`, `first_response_at` |
| Resolution SLA | `resolution_target_hours`, `resolution_sla_status`, `resolution_due_at`, `resolved_at` |
| Pause and escalation | `paused_at`, `total_paused_minutes`, `escalation_level`, `last_escalated_at`, `last_escalation_reason` |

Timestamps are stored as text in ISO-style date-time format with timezone information. The schema includes pause-related fields for future pause/resume handling; the current SLA policy and monitor are designed around calendar-hour deadlines.

### Database behaviour

- Search by the ticket identifier derived from the email thread.
- Update an existing record when a matching ticket is found.
- Create a record when no matching ticket exists.
- Preserve existing ticket and SLA fields during updates rather than resetting the original creation/deadline timestamps.
- Store first-response and resolution SLA states independently.
- Record escalation level, timestamp, and reason to support operational traceability.

## 7. SLA monitoring and escalation logic

The SLA monitor searches for tickets whose status is not `RESOLVED`. It then evaluates the first-response and resolution paths independently.

A ticket is eligible for a breach path when:
- the relevant SLA status is `PENDING`;
- the ticket is not currently paused; and
- the relevant due timestamp is less than or equal to the current time.

On a first-response breach, the workflow marks `first_response_sla_status` as `BREACHED`. If the resolution deadline has also passed and its status is still pending, that status is updated as well.

On a resolution breach, the workflow marks `resolution_sla_status` as `BREACHED`. If the first-response deadline is also overdue and still pending, that status is updated too.

This cross-update prevents a ticket that has missed both deadlines from remaining incorrectly pending in one SLA dimension. Escalation metadata records the level, time, and reason. The monitor's current test configuration excludes the retained seed record `TKT-TEST-0001`.

## 8. Technology stack

- **Make.com:** scenario orchestration, scheduling, routing, filters, and data operations
- **Google Gemini:** support-ticket classification and structured AI output
- **Gmail:** support inbox intake and sent-reply event source
- **Make Data Store:** operational ticket database
- **Slack:** internal escalation notifications
- **Google Sheets:** intended reporting / audit view; not the operational source of truth

## 9. Testing and verification

### Verified real-email workflow tests

Two Make executions completed successfully against the dedicated test mailbox:

| Workflow | Evidence | Result |
|---|---|---|
| Incoming Ticket Intake | Gmail trigger → Gemini → JSON parse → Data Store search → UpdateRecord; 5 operations, no module errors | A follow-up email in an existing Gmail thread was classified and updated the matching ticket rather than creating another record. The original ticket ID and SLA deadlines were preserved. |
| Response & Resolution Lifecycle | Gmail Sent trigger → Data Store search → UpdateRecord; 3 operations, no module errors | A sent support reply from the dedicated support mailbox was matched to the same Gmail thread. `first_response_at` was recorded as `2026-11-10T08:07:13.000Z`, and the first-response SLA was marked `MET`. |

The P2 ticket was created at `2026-11-10T12:12:57+05:30`, giving a first-response deadline of `16:12:57+05:30`. The captured reply time was `13:37:13+05:30`, within the four-hour target. The existing ticket ID remained `TKT-1a1c4314c3ece1e4`.

### Verified SLA monitor tests

Temporary synthetic records were created with deliberately overdue deadlines:

| Test case | Expected result | Observed result |
|---|---|---|
| First-response deadline overdue; resolution deadline in the future | First-response `BREACHED`; resolution remains `PENDING`; escalation level 1 | Confirmed in Data Store |
| Resolution deadline overdue; first response already `MET` | Resolution `BREACHED`; first response remains `MET`; escalation level 2 | Confirmed in Data Store |
| Both deadlines overdue but ticket paused | Both statuses remain unchanged | Confirmed |
| Both deadlines overdue but ticket status is `RESOLVED` | Ticket is excluded from monitoring | Confirmed |
| Run monitor again after breach states have been recorded | Previously breached states are not reprocessed as pending | Confirmed; state unchanged |

All four temporary SLA test records were deleted after validation. The retained seed record `TKT-TEST-0001` remains excluded from monitoring.

**Verification limitation:** Make's execution inspector reported successful monitor runs but exposed only the root SearchRecord module in its module breakdown, despite the expected Data Store state transitions being visible afterward. Slack message delivery could not be independently confirmed through Slack message history. The alert path should therefore be treated as configured but not fully verified.

### Still to test

- A fresh email that takes the new-ticket creation path, not just an update to an existing thread.
- Gemini classification accuracy across more support categories and ambiguous messages.
- Resolution event capture and transition to `ticket_status = RESOLVED` with `resolved_at`.
- Independent confirmation of Slack alert delivery for each breach route.
- Event-level duplicate handling, concurrency, and recovery if an alert succeeds but the subsequent database update fails.
- Timezone and deadline-boundary edge cases.
- Error handling for malformed AI output, missing fields, and temporary app failures.

## 10. Known limitations and next improvements

1. **End-to-end validation:** Validate a fresh-email create path and complete the resolution lifecycle.
2. **Duplicate protection:** Strengthen event-level idempotency so repeated trigger deliveries cannot create duplicate tickets or repeat side effects.
3. **Resolution workflow:** Complete and test the resolution event and status transition to `RESOLVED`.
4. **Human ownership:** Add an explicit assignment/ownership workflow and escalation recipients by priority or team.
5. **Operational reporting:** Add a Google Sheets reporting layer for open tickets, SLA compliance, breach counts, and ageing. The Data Store remains the source of truth.
6. **Error handling:** Add deliberate handling for malformed AI responses, missing customer data, and failed downstream operations.
7. **Production readiness:** Add access controls, retention rules, monitoring, recovery procedures, and broader load testing before any real customer deployment.

## 11. Safety and operating boundaries

- Scenarios are kept inactive except during controlled tests.
- The prototype does not automatically send customer-facing replies.
- Escalation messages are internal notifications.
- Google Sheets is intended for reporting, not as the authoritative ticket database.
- No production-readiness claim is made until end-to-end, failure-path, and duplicate-event testing is complete.

## 12. Make scenarios

- [Incoming Ticket Intake](https://us2.make.com/3360492/scenarios/6966106)
- [SLA Monitoring & Escalations](https://us2.make.com/3360492/scenarios/6975614)
- [Response & Resolution Lifecycle](https://us2.make.com/3360492/scenarios/6975772)

---

*Built as a hands-on portfolio project to demonstrate AI integration, workflow orchestration, operational database design, date/time logic, SLA monitoring, and incident escalation.*

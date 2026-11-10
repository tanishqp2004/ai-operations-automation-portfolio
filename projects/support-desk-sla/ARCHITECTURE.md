# Technical Design — AI Support Desk & SLA Incident Manager

This document records the implementation-level design of the portfolio prototype. For the business overview and current test status, see [README.md](./README.md).

## 1. System boundaries

The solution is split into three Make.com scenarios so that email intake, deadline enforcement, and response lifecycle updates can be tested and operated separately.

| Scenario | Make scenario ID | Trigger / cadence | Purpose |
|---|---:|---|---|
| Incoming Ticket Intake | `6966106` | Gmail polling, 15 minutes | Convert incoming email events into ticket records |
| SLA Monitoring & Escalations | `6975614` | Scheduled, every 15 minutes | Detect overdue SLA commitments and update escalation state |
| Response & Resolution Lifecycle | `6975772` | Gmail sent-mail polling, 15 minutes | Capture response events and update the matching ticket |

All three scenarios are currently inactive outside controlled tests.

## 2. Data store design

**Data Store:** `AI Support Desk — Ticket Database`  
**Data Store ID:** `196833`  
**Data structure:** `Support Ticket Record`  
**Structure ID:** `573737`  
**Strict validation:** enabled

The Data Store is the operational source of truth. Google Sheets is reserved for a future reporting/audit view.

### Field catalogue

| Field | Type | Purpose |
|---|---|---|
| `ticket_id` | Text | Stable business identifier used to locate a ticket |
| `source` | Text | Originating channel, currently Gmail |
| `source_event_id` | Text | Identifier for the event that created the record |
| `customer_name` | Text | Customer display name |
| `customer_email` | Text | Customer email address |
| `subject` | Text | Original email subject |
| `description` | Text | Request body / issue description |
| `category` | Text | AI-assigned support category |
| `priority` | Text | P1, P2, P3, or P4 |
| `sentiment` | Text | AI-assessed customer sentiment |
| `ai_summary` | Text | Concise AI-generated issue summary |
| `assigned_team` | Text | Suggested or assigned support team |
| `ticket_status` | Text | Overall ticket state |
| `first_response_sla_status` | Text | First-response SLA state |
| `resolution_sla_status` | Text | Resolution SLA state |
| `first_response_target_hours` | Number | First-response target derived from priority |
| `resolution_target_hours` | Number | Resolution target derived from priority |
| `created_at` | Text | Ticket creation timestamp |
| `first_response_due_at` | Text | First-response deadline |
| `first_response_at` | Text | Captured first-response timestamp |
| `resolution_due_at` | Text | Resolution deadline |
| `resolved_at` | Text | Captured resolution timestamp |
| `paused_at` | Text | Pause-start timestamp; blank when not paused |
| `total_paused_minutes` | Number | Accumulated paused duration; reserved for pause/resume logic |
| `escalation_level` | Number | Current escalation level |
| `last_escalated_at` | Text | Timestamp of most recent escalation |
| `last_escalation_reason` | Text | Reason for most recent escalation |
| `last_source_event_id` | Text | Most recently processed source event |
| `created_by` | Text | Record creation source / actor |
| `updated_at` | Text | Last record update timestamp |
| `internal_notes` | Text | Internal operational notes |

The Data Store also generates its own record key. The workflow searches on the business field `ticket_id`, then uses the returned Data Store key for updates.

## 3. Ticket identifier and upsert pattern

The intake flow derives a ticket identifier from the Gmail thread so that messages belonging to the same conversation can be associated with the same ticket.

The intended lookup pattern is:

1. Search the Data Store for `ticket_id = TKT-<Gmail thread ID>`.
2. If a record is found, update it using its returned Data Store key.
3. If no record is found, create a new record and initialize the SLA timestamps.

This is a search-then-update/create pattern rather than a database-native unique constraint. Concurrency and duplicate-delivery behaviour therefore require further testing and hardening.

## 4. Incoming Ticket Intake — module map

Scenario ID: `6966106`

| Module ID | Module | Responsibility |
|---:|---|---|
| 1 | Gmail — Watch new emails | Poll the support inbox for incoming messages |
| 2 | Gemini AI — Create completion | Classify the email and produce structured ticket data |
| 3 | JSON — Parse JSON | Convert the AI response into mapped fields |
| 4 | Data Store — Search record | Find an existing ticket by ticket identifier |
| 5 | Basic If/Else | Split existing-ticket and new-ticket paths |
| 6 | Data Store — Update record | Update an existing ticket while preserving original SLA timestamps |
| 11 | Data Store — Add record | Create a new ticket and initialize calendar-hour deadlines |

The Gmail trigger is configured with the query `in:inbox -from:me`, full message format, a limit of 10, and `markSeen=false`. Its polling interval is 15 minutes. The user selected and saved the trigger start point as **From now on** in the Make editor; the trigger cursor is not independently visible in the configuration readback available to this documentation process.

**Known mapping defect:** The AddRecord module currently maps `description` from `{{1.text}}`. The Gmail trigger bundle exposes `fullTextBody` rather than `text`; the successful new-ticket execution showed the mapped `description` value as `null`. Correct this mapping to `{{1.fullTextBody}}` and rerun a fresh-email create test before considering intake validation complete.

## 5. SLA policy and deadline calculation

The policy is priority-driven:

| Priority | First-response target | Resolution target |
|---|---:|---:|
| P1 | 1 hour | 4 hours |
| P2 | 4 hours | 12 hours |
| P3 | 8 hours | 24 hours |
| P4 | 24 hours | 72 hours |

For a ticket created at timestamp (t_0):

[
t_{first response due} = t_0 + H_{first response}
]

[
t_{resolution due} = t_0 + H_{resolution}
]

The target values are calendar hours. The implementation stores ISO-style date-time strings with timezone information. The monitor compares the due timestamp with the current time.

**Example:** P1 ticket created at 10:00 → first response due at 11:00; resolution due at 14:00.

The configured monitor interval is 900 seconds (15 minutes). A breach is therefore detected on the next monitor run, not at the exact deadline instant.

## 6. SLA Monitoring & Escalations — module map

Scenario ID: `6975614`

| Module ID | Module | Responsibility |
|---:|---|---|
| 1 | Data Store — Search records | Retrieve tickets whose overall status is not `RESOLVED` |
| 2 | Basic Router | Evaluate first-response and resolution SLA paths independently |
| 3 | Slack — Create message | Send first-response breach alert |
| 4 | Data Store — Update record | Mark first-response SLA breached and update escalation metadata |
| 5 | Slack — Create message | Send resolution breach alert |
| 6 | Data Store — Update record | Mark resolution SLA breached and update escalation metadata |

### Route eligibility

Each route requires the relevant SLA state to be `PENDING`, the ticket to be unpaused, and its relevant due timestamp to be less than or equal to the current time.

The pause guard checks that `paused_at` is empty. A seed test record with ticket ID `TKT-TEST-0001` is explicitly excluded from the monitor.

### State transition behaviour

**First-response route**
- Set `first_response_sla_status = BREACHED`.
- If the resolution deadline has also passed and `resolution_sla_status = PENDING`, set the resolution status to `BREACHED` too.
- Set escalation level to at least 1, or 2 if both dimensions are overdue.
- Record escalation timestamp and reason.

**Resolution route**
- Set `resolution_sla_status = BREACHED`.
- If the first-response deadline has also passed and `first_response_sla_status = PENDING`, set the first-response status to `BREACHED` too.
- Set escalation level to at least 2.
- Record escalation timestamp and reason.

The two routes update different SLA dimensions, while also reconciling the other dimension if it is independently overdue. This avoids leaving a second overdue SLA marked as pending.

## 7. Response & Resolution Lifecycle — module map

Scenario ID: `6975772`

| Module ID | Module | Responsibility |
|---:|---|---|
| 1 | Gmail — Watch sent emails | Poll sent-mail events |
| 2 | Data Store — Search record | Find the ticket using the Gmail thread identifier |
| 3 | Data Store — Update record | Record first-response timestamp and calculate whether it met the target |

The update path is intended to run only when a matching ticket exists and `first_response_at` is empty. It preserves a previously recorded `BREACHED` state; otherwise, it compares the captured sent timestamp with `first_response_due_at` and records `MET` or `BREACHED`.

**Verified first-response path:** A real sent reply from the dedicated support mailbox was captured by the Gmail Sent trigger, matched to the ticket using the Gmail thread ID, and written to `first_response_at`. The execution completed all three modules without reported errors. The captured timestamp was `2026-11-10T08:07:13.000Z`; the ticket's P2 first-response deadline was `2026-11-10T16:12:57+05:30`, so the stored result was `MET`. A complete resolution event and transition to `RESOLVED` remain to be implemented and tested.

## 8. Idempotency and consistency considerations

Current design protections:
- Search by Gmail thread-derived ticket ID before creating a new ticket.
- Update existing records rather than intentionally creating a new ticket for every email in the same thread.
- Require SLA status `PENDING` before a breach route runs.
- Change the SLA status to `BREACHED` after escalation so subsequent monitor runs do not repeatedly process the same pending state.
- Preserve original ticket creation and SLA deadline fields when updating an existing ticket.

Remaining risks:
- Search-then-create can race if two events for the same thread are processed concurrently.
- `source_event_id` and `last_source_event_id` are available for event-level deduplication but full duplicate-event handling has not yet been validated.
- A failure after an alert is sent but before the Data Store update could cause a repeated alert on a later run. The alert/update sequence and recovery behaviour need further hardening.
- Repeated sent-mail events and thread matching need real-account tests.

## 9. Test evidence

### Intake and response lifecycle

- New-ticket intake completed a successful five-operation run: Gmail trigger, Gemini classification, JSON parsing, Data Store search, and AddRecord. The new-ticket branch was reached and created the ticket record. Inspection of the AddRecord input exposed a field-mapping defect: `description` was `null` because the mapper uses `{{1.text}}`, while the Gmail trigger bundle exposes `fullTextBody`. Correct the mapping to `{{1.fullTextBody}}` and retest before treating this path as complete.
- Existing-ticket intake completed a successful five-operation run through UpdateRecord. A follow-up in the existing Gmail thread updated ticket ID `TKT-1a1c4314c3ece1e4`; the original creation time and SLA deadlines were preserved.
- Response & Resolution Lifecycle completed a successful three-operation run: Gmail Sent trigger, Data Store search, and UpdateRecord. The sent reply was matched to the same Gmail thread, `first_response_at` was recorded as `2026-11-10T08:07:13.000Z`, and the first-response status was correctly set to `MET` because the reply arrived before the P2 four-hour deadline.

### SLA monitor and negative controls

Temporary synthetic records were created with deliberately overdue deadlines.

| Case | Expected | Verified Data Store state |
|---|---|---|
| First-response overdue only | First response `BREACHED`; resolution remains `PENDING`; escalation level 1 | Matched |
| Resolution overdue; first response already `MET` | Resolution `BREACHED`; first response remains `MET`; escalation level 2 | Matched |
| Both deadlines overdue; ticket paused | Both SLA states remain unchanged | Matched |
| Both deadlines overdue; ticket already `RESOLVED` | Ticket excluded from monitoring | Matched |
| Run monitor again after statuses are `BREACHED` | Previously breached states are not processed as pending again | Matched; states unchanged |

All four temporary synthetic records were deleted after testing. The retained seed record `TKT-TEST-0001` remains excluded from the monitor.

**Verification limitation:** Both monitor runs returned success and the Data Store state transitions were visible afterward, but the execution inspector exposed only the root SearchRecord module in its module breakdown. Slack notification delivery could not be independently verified through Slack history. Treat the database state-transition tests as verified, but the actual Slack alert delivery as not yet independently verified.

## 10. Outstanding engineering work

1. Correct the new-ticket description mapping from `{{1.text}}` to `{{1.fullTextBody}}` and rerun the AddRecord path to verify the email body is saved.
2. Expand intake tests across support categories, priorities, and ambiguous messages.
3. Retest Gmail polling and sent-mail matching over repeated cycles.
4. Implement and test the resolution event, including the transition to `ticket_status = RESOLVED` and `resolved_at`.
5. Add robust event-level idempotency and consider concurrent executions.
6. Verify Slack delivery and design retry/recovery behaviour around alert and state-update failures.
7. Add validation and fallback handling for malformed Gemini output and missing fields.
8. Add a reporting view without moving operational ownership out of the Data Store.
9. Run broader timezone, boundary-time, paused-ticket, and failure-path tests before considering production use.

## 11. Security and operational guardrails

- Keep scenarios inactive outside controlled testing until all critical paths are validated.
- Do not send customer-facing responses automatically; retain human review and approval.
- Keep internal escalation notifications separate from customer communication.
- Do not put credentials, API keys, access tokens, or real customer data in repository documentation or screenshots.
- Treat this repository as technical project documentation, not as an operational runbook for a live support service.

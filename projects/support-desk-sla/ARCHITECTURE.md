# Technical Design — AI Support Desk & SLA Incident Manager

This document records the implementation-level design of the portfolio prototype. For the business overview and current test status, see [README.md](./README.md).

## 1. System boundaries

The solution is split into four Make.com scenarios so that email intake, deadline enforcement, response lifecycle updates, and reporting refresh can be tested and operated separately.

| Scenario | Make scenario ID | Trigger / cadence | Purpose |
|---|---:|---|---|
| Incoming Ticket Intake | `6966106` | Gmail polling, 15 minutes | Convert incoming email events into ticket records |
| SLA Monitoring & Escalations | `6975614` | Scheduled, every 15 minutes | Detect overdue SLA commitments and update escalation state |
| Response & Resolution Lifecycle | `6975772` | Gmail sent-mail polling, 15 minutes | Capture response events and update the matching ticket |
| Google Sheets Reporting Refresh | `6979683` | Scheduled, every 15 minutes when enabled | Refresh the reporting register and dashboard from the operational Data Store |

All four scenarios are currently inactive outside controlled tests.

## 2. Data store design

**Data Store:** `AI Support Desk — Ticket Database`  
**Data Store ID:** `196833`  
**Data structure:** `Support Ticket Record`  
**Structure ID:** `573737`  
**Strict validation:** enabled

The Data Store is the operational source of truth. Google Sheets provides a reporting/audit view and is not authoritative for ticket state.

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

**Description mapping:** The AddRecord module maps `description` from `{{1.fullTextBody}}`. A controlled fresh-email create test confirmed that the full message body was persisted in the Data Store.

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
| 4 | Basic Router | Route first-response events separately from explicit resolution events |
| 5 | Data Store — Update record | When `[RESOLVED]` appears in the sent message subject or body, set ticket status to `RESOLVED`, populate `resolved_at`, and calculate resolution SLA result |

The first-response path runs only when a matching ticket exists and `first_response_at` is empty. It preserves a previously recorded `BREACHED` state; otherwise, it compares the captured sent timestamp with `first_response_due_at` and records `MET` or `BREACHED`.

The resolution path requires a matching, not-yet-resolved ticket and an explicit `[RESOLVED]` marker in either the sent message subject or body. It sets `ticket_status = RESOLVED`, records `resolved_at`, and evaluates `resolution_sla_status` against `resolution_due_at`. If the same sent message is the first recorded response, it also fills `first_response_at` and calculates the first-response SLA without overwriting an existing `MET` or `BREACHED` state.

**Verified first-response path:** A real sent reply from the dedicated support mailbox was captured by the Gmail Sent trigger, matched to the ticket using the Gmail thread ID, and written to `first_response_at`. The execution completed all three modules without reported errors. The captured timestamp was `2026-11-10T08:07:13.000Z`; the ticket's P2 first-response deadline was `2026-11-10T16:12:57+05:30`, so the stored result was `MET`. **Verified resolution path:** The automatic sent-mail poll `50754c3fae884dc6a0f21865a106c77d` captured a reply in the same Gmail thread. The execution inspector confirmed Gmail trigger (Module 1), Data Store SearchRecord (Module 2), and Data Store UpdateRecord (Module 5) each ran once with zero errors. Data Store readback confirmed `ticket_status = RESOLVED`, `resolved_at = 2026-11-10T14:49:18.000Z`, and `resolution_sla_status = MET`. The scenario was deactivated after the successful test.

## 9. Google Sheets reporting layer

**Reporting workbook:** `AI Support Desk — SLA Operations Dashboard`  
**Workbook ID:** `1gLyLg1U3uJmrbMiwD4ckrfOGXD9R_kqMYyQgak8soc4`  
**Sheets:** `Dashboard`, `Ticket Register`  
**Refresh scenario:** `6979683`

The refresh clears the register's data rows, searches the operational Data Store while excluding the seed record `TKT-TEST-0001`, and writes ticket rows with calculated ageing and resolution time. Dashboard formulas summarize ticket volume, open/resolved counts, priority distribution, breach counts, compliance, pending SLAs, and open-ticket ageing. Formulas use whole-column ranges so that the dashboard remains valid as register rows grow. The refresh scenario has sequential execution enabled to prevent overlapping refresh runs.

A controlled refresh and readback reconciled the register to the two retained tickets: one open P2 with a breached resolution SLA, and one resolved P3 with both SLA results met. Dashboard readback matched 2 total tickets, 1 open, 1 resolved, 0 first-response breaches, 1 resolution breach, and 0.84 average resolution hours. This was a two-ticket snapshot validation, not a high-volume reporting benchmark.

## 9. Idempotency and consistency considerations

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

## 10. Test evidence

### Intake and response lifecycle

- New-ticket intake initially exposed a description mapping defect (`{{1.text}}` was null). The mapping was corrected to `{{1.fullTextBody}}`; a fresh controlled email test then confirmed the full message body was saved in the new Data Store record.
- Existing-ticket intake completed a successful five-operation run through UpdateRecord. A follow-up in the existing Gmail thread updated ticket ID `TKT-1a1c4314c3ece1e4`; the original creation time and SLA deadlines were preserved.
- Response & Resolution Lifecycle first-response test completed a successful three-operation run: Gmail Sent trigger, Data Store search, and UpdateRecord. The sent reply was matched to the same Gmail thread, `first_response_at` was recorded as `2026-11-10T08:07:13.000Z`, and the first-response status was correctly set to `MET` because the reply arrived before the P2 four-hour deadline.
- Resolution lifecycle test completed a separate successful three-operation automatic run. Module 5 updated ticket `TKT-1a1c5c0cf091a53b` to `RESOLVED`, populated `resolved_at = 2026-11-10T14:49:18.000Z`, and set `resolution_sla_status = MET`. The first-response SLA remained `MET`. The execution inspector showed zero errors for all three executed modules.

### SLA monitor and negative controls

Temporary synthetic records were created with deliberately overdue deadlines.

| Case | Expected | Verified Data Store state |
|---|---|---|
| First-response overdue only | First response `BREACHED`; resolution remains `PENDING`; escalation level 1 | Matched |
| Resolution overdue; first response already `MET` | Resolution `BREACHED`; first response remains `MET`; escalation level 2 | Matched |
| Both deadlines overdue; ticket active and unpaused | Both SLA states become `BREACHED`; escalation level 2 | Matched |
| Both deadlines overdue; ticket paused | Both SLA states remain unchanged | Matched |
| Both deadlines overdue; ticket already `RESOLVED` | Ticket excluded from monitoring | Matched |
| Run monitor again after statuses are `BREACHED` | Previously breached states are not processed as pending again | Matched; states unchanged |

All four temporary synthetic records were deleted after testing. The retained seed record `TKT-TEST-0001` remains excluded from the monitor.

**Verification limitation:** Monitor runs returned success and the Data Store state transitions were visible afterward, but the execution inspector exposed only the root SearchRecord module in its module breakdown. Slack notification delivery could not be independently verified through Slack history. Treat the database state-transition tests as verified, but actual Slack delivery as not yet independently verified. A separate external-sender new-thread intake test remains pending.

## 11. Outstanding engineering work

1. Run an external-sender new-thread intake test through the dedicated support inbox and verify the ticket ID, full description, AI fields, and calculated deadlines.
2. Expand intake tests across support categories, priorities, and ambiguous messages.
3. Retest Gmail polling and sent-mail matching over repeated cycles.
4. Expand resolution-marker tests, including marker in subject, marker in body, already-resolved tickets, and repeated sent-mail events.
5. Add robust event-level idempotency and consider concurrent intake executions.
6. Verify Slack delivery and design retry/recovery behaviour around alert and state-update failures.
7. Add validation and fallback handling for malformed Gemini output and missing fields.
8. Run broader timezone, boundary-time, and failure-path tests before considering production use.

## 12. Security and operational guardrails

- Keep all four scenarios inactive outside controlled testing until all critical paths are validated.
- Do not send customer-facing responses automatically; retain human review and approval.
- Keep internal escalation notifications separate from customer communication.
- Do not put credentials, API keys, access tokens, or real customer data in repository documentation or screenshots.
- Treat this repository as technical project documentation, not as an operational runbook for a live support service.

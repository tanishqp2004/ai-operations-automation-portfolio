# AI Voice Receptionist & Business Booking Agent

An AI-powered receptionist prototype for a fictional dental clinic. It answers spoken enquiries, checks live appointment availability, collects booking details, and creates, cancels or reschedules appointments through a secured backend.

> **Project status (19 November 2026):** Core voice booking and management tools are implemented and tested. The database booking engine, Vapi adapter, booking API, Make booking webhook, and a separate automated staff-email dispatcher are active. A corrected staff-inbox test email was confirmed received. Appointment-event notification triggers and the cron dispatcher have been verified. Final regression testing, operational escalation, and browser-demo packaging remain. This is a portfolio prototype, not a production clinic system.

## 1. Business problem

Small service businesses often handle appointment enquiries and bookings manually. Staff must answer repetitive questions, check calendars, collect customer details, and avoid double-booking. An AI receptionist can handle routine interactions while keeping booking operations connected to a controlled source of truth.

## 2. Solution overview

The voice assistant speaks with callers and invokes narrowly scoped tools. A Supabase Edge Function validates each request, then calls database booking functions using a server-side service-role credential. A separate Make webhook provides an integration/orchestration path to the same booking API.

### Architecture

```mermaid
flowchart TD
    A[Caller] --> B[Vapi voice assistant]
    B --> C[Availability / booking / cancel / reschedule tools]
    C --> D[Supabase Edge Function: Vapi adapter]
    D --> E[Supabase Edge Function: Booking API]
    E --> F[(Postgres booking engine)]
    G[External workflow client] --> H[Make booking webhook]
    H --> I[Make HTTP request]
    I --> E
    F --> J[Appointment event triggers]
    J --> K[(Notification outbox)]
    L[Supabase pg_cron] --> M[Make email dispatcher webhook]
    M --> N[Claim staff notifications API]
    N --> K
    M --> O[Gmail send]
    O --> P[Mark sent / record failure API]
    P --> K
```

## 3. Technology stack

- **Vapi:** conversational voice agent, function tools, turn-taking and idle prompts.
- **Google Gemini:** language model used by the assistant.
- **Deepgram Nova-3:** speech transcription, configured for automatic language handling.
- **Supabase Postgres:** multi-tenant relational data model, booking rules and notification outbox.
- **Supabase Edge Functions:** authenticated booking API, Vapi tool adapter and notification-outbox API.
- **Make.com:** booking webhook orchestration and scheduled email dispatch workflow.
- **Gmail:** staff notification delivery for the demo.
- **PowerShell:** local integration checks during development.

## 4. Booking workflow

1. The caller states the service and requested date.
2. The assistant confirms the full calendar date, including the year.
3. The availability tool requests slots for the selected service and date.
4. The backend returns only valid future slots within business hours and without active appointment conflicts.
5. The assistant offers returned slots; it must not invent availability.
6. The assistant collects the caller's name and phone number.
7. Before creating the appointment, the assistant repeats the service, full date, time, name and phone number and obtains explicit confirmation.
8. The booking tool submits the request. The assistant confirms only after a successful backend response.
9. The assistant can also cancel or reschedule using the human-readable appointment reference.

## 5. Database model

The demo uses seven tables:

| Table | Purpose |
|---|---|
| `businesses` | Business identity, active state, timezone and staff notification address |
| `customers` | Customer contact details scoped to a business |
| `services` | Service names, durations and demo prices |
| `business_hours` | Weekly opening hours |
| `appointments` | Appointment lifecycle, booking reference, resource and time range |
| `call_logs` | Call metadata and outcome tracking |
| `notification_outbox` | Idempotent appointment-event email queue, retry state and provider response |

Appointments use a Postgres exclusion constraint to prevent overlapping active bookings for the same business/resource. Customer and service foreign keys are scoped to the same business. Timestamps are stored as `timestamptz`; the demo business uses `Asia/Kolkata`.

The fictional business is **Aarogya Dental Studio**, with synthetic dental services, sample prices and opening hours. Contact details and prices are placeholders for demonstration only.

## 6. Backend functions and security

Database functions:
- `get_available_slots`
- `create_booking`
- `cancel_booking`
- `reschedule_booking`
- `claim_email_notifications`
- `set_email_notification_result`

Edge Functions:
- `receptionist-booking-api`: validates a shared API key and routes availability, booking, cancellation and rescheduling actions to Postgres RPCs.
- `vapi-receptionist-tools`: validates a separate Vapi tool key, translates Vapi function-call envelopes into booking API requests, and returns Vapi-compatible tool results.
- `notification-outbox-api`: authenticates Make requests and exposes controlled claim/result operations for the email outbox.

Security decisions:
- Row Level Security is enabled on all seven public tables.
- No broad anonymous or authenticated policies are present; direct public table access remains blocked.
- Booking and outbox RPC execution is restricted to the server-side service role.
- The service-role key is held server-side and is never sent to the browser or voice assistant.
- The Vapi adapter has its own credential and does not expose the internal booking API credential.
- The notification worker claims only staff notifications whose recipient matches the business's currently configured notification email.
- Secrets are intentionally excluded from this repository.

## 7. Make orchestration

### Booking webhook

The active Make scenario, **Project 04 - Receptionist Booking Webhook**, contains:
1. Custom webhook trigger.
2. HTTP POST to the Supabase booking API.
3. Webhook response mapped from the API response.

It supports availability, booking, cancellation and rescheduling requests.

### Email dispatcher

The active Make scenario, **Project 04 - Email Notification Dispatcher**, contains:
1. Custom webhook trigger (invoked by Supabase cron).
2. Claim due staff email notifications from the outbox API.
3. Iterate over claimed notifications.
4. Send the email through Gmail.
5. Mark the notification sent with the provider message ID.
6. On Gmail module failure, record a failed attempt for retry.

Supabase `pg_cron` invokes the Make dispatcher webhook every minute. The outbox uses a processing lease, bounded attempts and exponential retry backoff. The worker is deliberately restricted to staff email; customer email delivery is not enabled.

## 8. Testing evidence

| Test | Result |
|---|---|
| Live Vapi availability | Assistant checked availability and offered returned slots |
| Voice booking | Test booking completed after explicit confirmation; human-readable reference returned |
| Voice rescheduling | Test appointment successfully rescheduled using its booking reference |
| Voice cancellation | Test appointment cancellation confirmed in the database |
| Date validation | Explicit full dates work; invalid/past dates are rejected by the backend |
| Appointment event triggers | Rolled-back SQL test verified one staff outbox event each for confirmation, cancellation and rescheduling |
| Staff email dispatch | Corrected staff inbox test processed through all five Make modules and confirmed received by the user |
| Cron health | 25 successful runs and zero failed runs in a 30-minute inspection window |
| Security/performance review | RLS posture reviewed; missing outbox business-FK index added; no health advisor findings |

The trigger QA ran inside a rolled-back transaction, so no synthetic appointments or email events from that test were retained. The email test was a clearly labelled synthetic staff notification, not a real customer booking.

## 9. Current limitations

- The complete voice booking, cancellation and rescheduling flows have been tested, but a final broad regression across conflicts, caller corrections, invalid input and timeouts is still needed.
- Email provider acceptance and one confirmed inbox receipt were verified; future delivery is not guaranteed.
- If Gmail sends successfully but the subsequent status callback fails, a retry could produce a duplicate email. Exactly-once email delivery is not guaranteed.
- A durable staff escalation/dead-letter review workflow is not yet implemented. No SMS or secondary alert channel is configured.
- Customer confirmation emails are not enabled in the dispatcher.
- Browser-based voice demo packaging is still pending.
- Indian PSTN number support has not been established for this Vapi setup; the planned portfolio demonstration should use a browser voice interface unless a compliant telephony route is separately validated.
- The clinic and its service prices are fictional. The agent is administrative only and must not diagnose conditions or recommend treatment.

## 10. Next steps

1. Run a final end-to-end voice regression covering booking, cancellation, rescheduling, conflicts, invalid dates, caller corrections and tool/API failures.
2. Review the Make dispatcher error path and duplicate-send edge case if Gmail succeeds but the status callback fails.
3. Add a durable staff escalation/dead-letter review workflow for notifications that exhaust retries.
4. Decide whether customer confirmation emails should be enabled and separately tested.
5. Package a browser voice demo and record a short walkthrough.
6. Review and reduce temporary diagnostic logging before any production-like deployment.
7. Capture screenshots, execution evidence and a concise project demo for the portfolio.

## Safety boundary

This is a fictional administrative booking demonstration. It is not connected to a real dental clinic, does not provide medical advice, and is not represented as production-ready.

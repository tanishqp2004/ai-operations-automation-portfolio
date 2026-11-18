# Technical Architecture — AI Voice Receptionist

## System boundaries

The legacy voice demo is split into four layers:

1. **Conversation layer:** Vapi assistant, Gemini model, Deepgram transcription, voice configuration, system prompt and function tools.
2. **Integration layer:** Vapi adapter Edge Function, booking API Edge Function, notification-outbox API and two Make scenarios.
3. **Data layer:** Supabase Postgres tables, constraints, triggers and RPC functions.
4. **Operations layer:** Supabase pg_cron, notification outbox, Make email dispatcher and Gmail staff notifications.

## Request paths

### Legacy single-clinic voice assistant path

```text
Caller
  -> Vapi assistant
  -> availability / book / cancel / reschedule tool
  -> POST /functions/v1/vapi-receptionist-tools
  -> authenticate x-vapi-receptionist-key
  -> resolve fixed demo business and service
  -> POST /functions/v1/receptionist-booking-api
  -> authenticate x-receptionist-key
  -> Supabase RPC
  -> Postgres
  -> Vapi-compatible tool result
  -> assistant speaks the result
```

The legacy adapter maps six service labels to fixed demo service UUIDs and a fixed fictional business UUID. It converts local India date/time values to an explicit +05:30 offset before calling the booking API. Appointment references are human-readable and accepted by cancellation/rescheduling tools. This path is not yet tenant-aware and must not be reused for SaaS customers without redesign.

### Make booking path

```text
Client
  -> Make booking custom webhook
  -> HTTP POST
  -> Supabase booking API
  -> Make webhook response
  -> Client
```

The active booking scenario has three modules: webhook trigger, HTTP request, webhook response. It supports availability, booking, cancellation and rescheduling.

### Staff email notification path

```text
Appointment INSERT/UPDATE
  -> Postgres appointment trigger
  -> notification_outbox (idempotency key)
  -> pg_cron every minute
  -> Make dispatcher webhook
  -> notification-outbox-api: claim
  -> Make iterator
  -> Gmail send
  -> notification-outbox-api: mark sent
       or record failed attempt
  -> retry with backoff / processing lease
```

The dispatcher claims only `recipient_type = staff` rows whose recipient matches the business's currently configured notification email. This prevents the worker from sending customer messages before that path is separately designed and tested. Gmail errors are recorded for retry; a durable secondary escalation channel is not yet implemented.

## Data model and integrity

The legacy demo database has seven public tables:

- `businesses` is the tenant root.
- `customers` and `services` carry `business_id`.
- `business_hours` stores each business's weekly hours.
- `appointments` references customer and service through composite foreign keys that include `business_id`, preventing cross-tenant references.
- `call_logs` stores call metadata and outcome tracking.
- `notification_outbox` stores appointment email events, recipient, idempotency key, status, attempt count, retry time and provider message ID.

Active appointment overlap is blocked by a Postgres exclusion constraint on business, resource and half-open time range. Appointment status values: `pending`, `confirmed`, `completed`, `cancelled`, `no_show`. Booking source values: `ai_receptionist`, `staff`, `web`, `phone`. The demo business timezone is `Asia/Kolkata`; stored timestamps are timezone-aware.

Appointment triggers enqueue staff email events for:
- A confirmed appointment insert or transition to confirmed.
- Cancellation from pending/confirmed.
- A confirmed appointment time change (reschedule).

Customer notification rows may be enqueued when a customer email exists, but the current dispatcher intentionally does not claim or send customer notifications.

## Privilege model

### Legacy demo

- RLS enabled on all seven public tables.
- No anonymous/authenticated table policies have been created; direct table access remains blocked.
- Booking and outbox RPC functions are restricted to the server-side service role.

### SaaS staging

- Separate Supabase project: `Project-04-SaaS-Staging-Mumbai`, Mumbai region, quoted at $0/month. The original demo project remains untouched.
- Ten application tables: `businesses`, `business_memberships`, `services`, `business_hours`, `customers`, `appointments`, `call_logs`, `notification_outbox`, `business_integrations`, `audit_logs`.
- RLS enabled on all 10 tables with 26 policies based on authenticated business membership and owner/admin/staff roles.
- `private.has_business_role` is a SECURITY DEFINER helper in the non-exposed `private` schema; execution is restricted to authenticated/service roles.
- `create_business_for_current_user` is SECURITY INVOKER. A private trigger assigns the authenticated creator as owner; business hours start closed until configured.
- Availability, create, cancel and reschedule RPCs use SECURITY INVOKER and verify membership. Booking creation validates name/phone/email/notes and supports a per-business idempotency key.
- Security advisor: no findings after the onboarding RPC was changed to SECURITY INVOKER. Performance advisor currently reports unused indexes on the empty staging database; these are expected before workload testing.
- No demo clinic, customer, appointment or call-log records were copied into staging.
- Edge Functions have JWT verification disabled because they use their own shared-key authentication. Requests without the relevant custom header are rejected by function code.
- The service-role key and shared API keys remain in server-side secret stores. Never commit them or expose them in browser code, Vapi configuration, screenshots or logs.
- The Make dispatcher credential is stored in Make; the cron job retrieves the webhook URL from Supabase Vault.

## Tool contracts

### Vapi function tools configured

- `check_appointment_availability(service_name, local_date)`
- `book_appointment(service_name, customer_name, customer_phone, local_date, local_time, customer_email?, notes?)`
- `cancel_appointment(appointment_reference)`
- `reschedule_appointment(appointment_reference, new_local_date, new_local_time)`

The assistant must obtain explicit caller confirmation before creating a booking and must only report availability returned by the backend.

## Verification state as of 19 November 2026

- Legacy Supabase project is active in the Mumbai region.
- SaaS staging project is active and healthy in the Mumbai region; it contains 10 empty application tables, 26 RLS policies and four SECURITY INVOKER booking RPCs.
- Booking API, Vapi adapter and notification-outbox API are deployed.
- Both Make scenarios are active.
- Live Vapi tests verified availability, booking, human-readable reference readback, rescheduling and cancellation.
- A rolled-back SQL transaction verified each appointment notification trigger enqueued exactly one corresponding staff event.
- The corrected staff inbox test passed through all five dispatcher modules; Gmail returned a provider message ID and the user confirmed receipt.
- The one-minute cron completed 25 successful runs with zero failed runs in the inspected 30-minute window.
- Security and performance advisors were reviewed. RLS-without-policy notices are intentional under the server-only access model. The `pg_net`-in-public-schema warning remains an advisory. An index was added for `notification_outbox.business_id`.

## Operational caveats

- The email worker uses bounded retries, exponential backoff and a 15-minute processing lease. If Gmail succeeds but the subsequent status callback fails, a later retry can duplicate the message; exactly-once delivery is not guaranteed.
- A durable dead-letter/staff escalation workflow and secondary alert channel are not yet implemented.
- Customer email dispatch is deliberately disabled; only staff notifications are processed.
- Temporary diagnostic logs were added during Vapi integration testing. Review and reduce them before production-like deployment; never log API keys or customer contact details.
- The business and all service/pricing details are fictional. No real patient records are used.
- Do not claim Indian PSTN telephony support unless a compliant provider and call path are separately validated.
- This is a portfolio prototype, not a production-ready clinic system.

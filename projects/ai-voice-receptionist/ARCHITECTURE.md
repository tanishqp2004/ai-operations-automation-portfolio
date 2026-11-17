# Technical Architecture — AI Voice Receptionist

## System boundaries

The project is split into three layers:

1. **Conversation layer:** Vapi assistant, Gemini model, Deepgram transcription, voice configuration, system prompt and function tools.
2. **Integration layer:** Vapi adapter Edge Function, booking API Edge Function and Make webhook scenario.
3. **Data layer:** Supabase Postgres tables, constraints and RPC functions.

## Request paths

### Voice assistant path

```text
Caller
  -> Vapi assistant
  -> check_appointment_availability / book_appointment
  -> POST /functions/v1/vapi-receptionist-tools
  -> authenticate x-vapi-receptionist-key
  -> translate service name and local date/time
  -> POST /functions/v1/receptionist-booking-api
  -> authenticate x-receptionist-key
  -> Supabase RPC
  -> Postgres
  -> Vapi-compatible results[] response
  -> assistant speaks the result
```

The adapter currently maps six service labels to fixed demo service UUIDs and a fixed fictional business UUID. It converts local India date/time values to an explicit +05:30 offset before calling the booking API.

### Make path

```text
Client
  -> Make custom webhook
  -> HTTP MakeRequest (POST)
  -> Supabase booking API
  -> WebhookRespond (status + JSON body)
  -> Client
```

The Make webhook accepts fields for availability, booking, cancellation and rescheduling. The Make scenario is active and contains three modules: webhook trigger, HTTP request, webhook response.

## Data model and integrity

- `businesses` is the tenant root.
- `customers` and `services` carry `business_id`.
- `appointments` references customer and service through composite foreign keys that include `business_id`, preventing cross-tenant references.
- Active appointment overlap is blocked by a Postgres exclusion constraint on business, resource and half-open time range.
- Appointment status values: `pending`, `confirmed`, `completed`, `cancelled`, `no_show`.
- Booking source values: `ai_receptionist`, `staff`, `web`, `phone`.
- The demo business timezone is `Asia/Kolkata`; stored timestamps are timezone-aware.

## Privilege model

- RLS enabled on all six tables.
- No anonymous/authenticated table policies have been created.
- Booking RPC functions are `SECURITY INVOKER`.
- Execute privileges are limited to `service_role` (plus owner privileges).
- Edge Functions have JWT verification disabled because they use their own shared-key authentication. This is intentional; requests without the relevant custom header are rejected by the function code.
- Secrets live in Supabase function secrets and Make/Vapi credential stores. Never commit them.

## Tool contracts

### Vapi function tools currently configured

- `check_appointment_availability(service_name, local_date)`
- `book_appointment(service_name, customer_name, customer_phone, local_date, local_time, customer_email?, notes?)`

### Adapter capabilities not yet attached to the assistant

- `cancel_appointment(appointment_id)`
- `reschedule_appointment(appointment_id, new_local_date, new_local_time)`

## Verification state as of 17 November 2026

- Supabase project is active in Mumbai region.
- Both Edge Functions are active.
- Make scenario is active, with no incomplete executions in the latest inspection.
- Availability returned 34 slots through Make for 18 Nov 2026.
- A live Vapi call for Routine Dental Check-up on 19 Nov 2026 returned 35 slots; Supabase edge logs confirmed service resolution and successful response.
- A disposable SQL transaction exercised availability, create and cancel without exception. The transaction was rolled back; a subsequent count query confirmed zero customer and appointment records.
- Full voice booking, voice cancellation/rescheduling, notifications, and browser-demo packaging remain unverified.

## Operational caveats

- Temporary availability diagnostic logs were added to the Vapi adapter during debugging. They log service name, requested date, service-resolution status, success flag and slot count; they do not log API keys or customer contact details. Remove them after testing.
- Do not expose the service-role key or either shared API key in client-side code, screenshots, logs or GitHub.
- The business and all service/pricing details are fictional. No patient records are used.
- Do not claim Indian PSTN telephony support unless a compliant provider and call path are separately validated.

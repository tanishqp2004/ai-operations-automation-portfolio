# AI Operations & Workflow Automation

I'm a B.Com graduate building practical AI-powered automation systems focused on improving business operations, finance workflows, and customer processes.

My focus is on combining no-code automation platforms, APIs, Python, and LLMs to solve real-world business problems.

## Featured Projects

### 1. AI-Powered Invoice Auditor & Reconciliation

An AI-assisted invoice processing workflow that extracts invoice information, checks subtotal and tax calculations against the stated total, logs audit results in Google Sheets, and flags discrepancies for human review.

**Tools:** Make.com, Gemini, Google Drive, Google Sheets, Gmail, JSON

**Key features:**
- Automated invoice intake from Google Drive
- AI-powered invoice data extraction
- Arithmetic reconciliation
- Discrepancy alerts for human review
- Automated audit logging

**Status:** Built; further testing and validation in progress.

### 2. Inbound Lead Triage & Concierge Pipeline

An AI-powered lead management workflow that classifies incoming enquiries, identifies high-priority leads, sends internal alerts, and generates personalized email responses.

**Tools:** Make.com, Gemini, Tally, Slack, Gmail, JSON

**Key features:**
- Automated lead capture
- AI-based lead classification
- Priority-based Slack notifications
- Personalized email responses

**Status:** Built; testing and refinement in progress.

### 3. AI Voice Receptionist & Business Booking Agent

A conversational receptionist prototype for a fictional dental clinic. Vapi handles the voice interaction, while secured Supabase Edge Functions and Postgres booking functions check live availability and create appointments. A Make webhook exposes the same booking API for workflow integrations.

**Tools:** Vapi, Google Gemini, Deepgram Nova-3, Supabase, PostgreSQL, Edge Functions, Make.com

**Key features:**
- Live appointment availability checks using service duration and business hours
- Booking engine with customer upsert and appointment lifecycle operations
- Database-level prevention of overlapping active appointments
- Separate API-key authentication for the Vapi adapter and booking API
- Server-side service-role access; no public table policies or client-side secret exposure
- Make webhook orchestration with JSON response handling

**Status:** Database, booking engine, Edge Functions, Make scenario, and Vapi availability/booking tools are configured. Live voice availability has been verified. A disposable database transaction tested availability → booking → cancellation and was rolled back. Full voice booking confirmation, cancellation/rescheduling tools, notifications, and browser-demo packaging remain in progress. Fictional demo only; not production-ready.

**Documentation:** [Project README](projects/ai-voice-receptionist/README.md) · [Technical architecture](projects/ai-voice-receptionist/ARCHITECTURE.md)

## Technical Skills

- **Automation:** Make.com, workflow design, routers, webhooks
- **AI:** Gemini, LLM integration, prompt engineering, structured outputs
- **Data & APIs:** JSON, REST API fundamentals
- **Programming:** Python fundamentals
- **Business Applications:** Google Sheets, Google Drive, Gmail, Slack

## Current Learning Focus

- Advanced Make.com workflows
- API integration and webhook handling
- Python for business automation
- AI-powered document processing
- Error handling and workflow reliability

## About Me

I am interested in AI Operations, Business Process Automation, and AI Solutions Implementation roles.

I believe in learning by building, documenting practical projects, and continuously improving systems through testing.

**Open to:** AI Operations | Workflow Automation | AI Implementation | Business Process Automation opportunities

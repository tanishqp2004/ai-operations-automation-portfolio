# Inbound Lead Triage & Concierge Pipeline

## 1. Project Overview

An AI-powered lead management workflow built using Make.com, Google Gemini, Tally, Slack, and Gmail.

The system captures incoming enquiries, classifies leads based on their requirements and urgency, notifies the internal team about high-priority leads, and sends personalized email responses.

## 2. Business Problem

Businesses receive enquiries from multiple potential customers, but manually reviewing and responding to every lead can be time-consuming.

Important or high-value leads may also get delayed when there is no structured prioritization process.

## 3. Solution

This workflow automates lead capture, AI-based classification, priority routing, internal notifications, and personalized email communication.

## 4. Workflow Architecture

1. **Lead Capture:** Tally collects incoming lead information through a form.
2. **AI Classification:** Google Gemini evaluates the enquiry and classifies the lead.
3. **Structured Output:** A JSON parser converts the AI response into structured data.
4. **Priority Routing:** Make.com evaluates the classification and urgency.
5. **Internal Notification:** High-priority or enterprise leads trigger a Slack notification.
6. **Automated Response:** Gmail sends a personalized email response to the lead.

## 5. Tools & Technologies

- Make.com — Workflow automation
- Google Gemini — AI-based lead classification
- Tally — Lead capture
- Slack — Internal team notifications
- Gmail — Automated email communication
- JSON — Structured data processing

## 6. Current Capabilities

- Automated lead intake
- AI-powered lead classification
- Urgency-based prioritization
- Enterprise lead identification
- Automated Slack alerts
- Personalized email responses

## 7. Business Use Case

This workflow can support sales teams, service businesses, agencies, and customer-facing operations teams that need to process incoming enquiries efficiently.

## 8. Limitations

- Classification depends on the quality of the submitted information.
- AI-generated classifications may require human review.
- The workflow needs further testing across different lead types.
- Production activation and reliability testing are still pending.

## 9. Future Improvements

- Integrate a CRM such as HubSpot.
- Add lead scoring based on business-defined criteria.
- Track response times and conversion rates.
- Add duplicate lead detection.
- Introduce error handling and fallback routes.

## 10. Project Status

**Built — Testing and refinement in progress.**

This workflow was built using Make.com and Gemini, with Gemini also used as a learning assistant during development. The scenario is currently inactive and is not being used in production.
## Workflow Architecture — Visual

![AI Invoice Auditor Workflow](screenshots/invoice-auditor-workflow.png)

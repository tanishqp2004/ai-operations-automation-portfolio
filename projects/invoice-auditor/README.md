# AI-Powered Invoice Auditor & Reconciliation

## 1. Project Overview

An AI-assisted invoice auditing workflow built with Make.com and Google Gemini. It extracts key information from incoming invoices, checks whether subtotal plus tax matches the stated total, records audit results in Google Sheets, and sends email alerts when arithmetic discrepancies are detected.

## 2. Business Problem

Manually reviewing invoices is repetitive and time-consuming. Arithmetic inconsistencies can be missed when handling multiple documents.

This project demonstrates how AI-assisted extraction and rule-based validation can reduce manual checking and bring exceptions to a human's attention.

## 3. Solution

The workflow automates invoice intake, data extraction, arithmetic validation, audit logging, and discrepancy notifications.

## 4. Workflow Architecture

1. **Invoice Intake:** Google Drive monitors the designated incoming-invoices folder.
2. **File Retrieval:** Make.com retrieves each detected invoice.
3. **AI Extraction:** Google Gemini extracts key invoice fields, including subtotal, tax amount, and stated total.
4. **Data Parsing:** The AI response is parsed into structured JSON fields.
5. **Validation:** Make.com compares subtotal plus tax against the stated invoice total.
6. **Routing:** The result follows the appropriate valid-invoice or discrepancy path.
7. **Reporting:** Audit results are recorded in Google Sheets. Discrepancies trigger an email alert for human review; valid invoices are logged without an alert.

## 5. Tools & Technologies

- **Make.com** — Workflow automation and routing
- **Google Gemini** — AI-assisted invoice data extraction
- **Google Drive** — Incoming invoice intake and storage
- **Google Sheets** — Audit log
- **Gmail** — Discrepancy notifications
- **JSON** — Structured data processing

## 6. Tested Capabilities

- Detects new invoice files in the designated Drive folder.
- Extracts key invoice fields using Gemini.
- Compares subtotal plus tax against the stated invoice total.
- Logs valid invoices with the status `AUDITED_OK`.
- Logs arithmetic discrepancies with the status `FLAGGED_DISCREPANCY`.
- Sends an email alert for discrepancies while valid invoices do not trigger an alert.

**Test outcome:** Controlled tests confirmed that valid invoices were logged without an alert and invoices with arithmetic mismatches triggered an alert.

## 7. Limitations

- Validation currently focuses on basic subtotal-plus-tax arithmetic.
- Duplicate invoice detection has not yet been implemented.
- The workflow does not verify invoice authenticity or vendor legitimacy.
- It does not independently validate tax-law compliance.
- Discounts, additional charges, rounding differences, missing fields, and extraction edge cases need broader testing.
- Human review is still required before acting on flagged invoices.
- This is a portfolio project, not a production-ready accounting control.

## 8. Future Improvements

- Add invoice number and currency extraction.
- Implement duplicate detection to prevent repeat entries in the audit sheet.
- Handle discounts, additional charges, and rounding tolerances.
- Improve error handling and missing-field checks.
- Build a larger test dataset and measure extraction and validation accuracy.

## 9. Project Status

**Core workflow built and successfully tested.**

The controlled tests verified the main validation and alert-routing behavior. Further testing and improvements—including duplicate prevention—are still required before considering production use.


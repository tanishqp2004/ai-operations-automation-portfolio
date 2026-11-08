# AI-Powered Invoice Auditor & Reconciliation

## 1. Project Overview

An AI-assisted invoice auditing workflow built using Make.com and Google Gemini. It extracts key information from invoices, checks whether the subtotal and tax add up to the stated total, records the results in Google Sheets, and sends email alerts when discrepancies are detected.

## 2. Business Problem

Manually reviewing invoices can be repetitive and time-consuming. Basic arithmetic inconsistencies may also go unnoticed when processing multiple invoices.

This workflow aims to reduce repetitive data entry and highlight potential calculation discrepancies for human review.

## 3. Solution

The workflow automates invoice intake, data extraction, arithmetic validation, record keeping, and discrepancy notifications.

## 4. Workflow Architecture

1. **Invoice Intake:** Google Drive monitors a designated folder for incoming invoices.
2. **File Retrieval:** The workflow retrieves the uploaded invoice.
3. **AI Extraction:** Google Gemini extracts the vendor name, invoice date, subtotal, tax amount, and total amount.
4. **Data Parsing:** The extracted JSON is parsed into structured fields.
5. **Validation:** The workflow compares subtotal plus tax against the stated invoice total.
6. **Routing:** The result is routed based on whether a discrepancy is detected.
7. **Reporting:** Results are logged in Google Sheets, while discrepancies trigger an email alert for human review.

## 5. Tools & Technologies

- Make.com — Workflow automation
- Google Gemini — AI-powered data extraction
- Google Drive — Invoice intake and file storage
- Google Sheets — Audit record management
- Gmail — Discrepancy notifications
- JSON — Structured data processing

## 6. Current Capabilities

- Automated invoice intake
- AI-based extraction of key invoice fields
- Arithmetic comparison of subtotal, tax, and stated total
- Automated discrepancy notifications
- Centralized audit logging

## 7. Limitations

- Currently checks basic subtotal and tax arithmetic only.
- Does not verify invoice authenticity or vendor legitimacy.
- Does not independently validate tax-law compliance.
- Extraction accuracy and edge cases require further testing.
- Human review remains necessary before acting on flagged invoices.

## 8. Future Improvements

- Add invoice number and currency extraction.
- Introduce duplicate invoice detection.
- Handle discounts, additional charges, and rounding differences.
- Improve error handling and missing-field detection.
- Build a test dataset to measure extraction and validation accuracy.

## 9. Project Status

**Built — Testing and refinement in progress.**

This project was built independently with Gemini used as a learning assistant during development. The workflow is currently inactive and is not being used for production invoice processing.
## 10. Workflow Architecture — Visual

![Invoice Auditor Workflow](screenshots/invoice-auditor-workflow.png)

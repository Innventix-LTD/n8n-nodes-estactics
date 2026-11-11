# Changelog

## 1.0.1

- The credential setup steps are one readable paragraph, n8n shows credential notices without line breaks or bold text.

## 1.0.0

- Estactics node with the **Lead → Create** operation: campaign picker (searchable list or code), name, email, phone, registration form answers, additional fields (location, language, notes, UTM) and custom fields JSON. Same request and output as the Estactics Zapier app.
- **Estactics API** credential (API token), tested by listing campaigns.
- Temporary failures are retried, clear messages for invalid tokens, missing permissions and the plan clients limit.
- Usable as an AI Agent tool.

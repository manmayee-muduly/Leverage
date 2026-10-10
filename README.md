# Fieldwork: Agent Systems Index

A responsive research dashboard prototype for examining enterprise AI-agent adoption, autonomy, workflow use, and evidence quality.

## Run locally

```bash
npm install
npm run dev
```

Create a production build with `npm run build`.

## Shipment demo

The **Shipment demo** is a local, rule-based simulation with three editable sample line items. Enter invoice and packing-list quantities manually (whole numbers from 0 to 100,000) and run the review; blank values are rejected and no documents are parsed. Each SKU is compared independently, so offsetting differences are still flagged even when grand totals match. A mismatch stops at a correction hold, while matching rows still require human confirmation. Each completed run creates an in-memory event timeline with timestamps, line-level results, rule outcome, and reviewer action; use **Export JSON** to download it. Resetting or refreshing clears the in-memory audit record. No shipment is submitted, and no external AI, customs, sanctions, or trade-compliance service is connected. The review-time comparison shown is illustrative, not measured.

## Import research data

Use **CSV template** in the dashboard to download the expected header row. CSV headers are case-insensitive; all columns are required:

| Column | Rules |
| --- | --- |
| `enterprise` | Non-empty organization label |
| `sector` | Non-empty industry or sector |
| `region` | Non-empty region or market |
| `size` | Non-empty size band, such as SME or Large |
| `stage` | `production`, `pilot`, or `exploring` |
| `autonomy_score` | Number from 0 to 100 |
| `efficiency_gain_pct` | Number from 0 to 100 |
| `primary_use_case` | Non-empty workflow description |
| `measured_outcome` | `yes` or `no` |

Imports are limited to 2 MB and 5,000 rows. Every row must validate before an upload replaces the current dataset. Accepted rows update dashboard filters and metrics, persist in this browser, and remain available after refresh. **Reset sample** clears the imported dataset from this browser. Export downloads the currently filtered rows.

## Data handling and limitations

The bundled organizations and six-month trend are synthetic examples, not market estimates. Imported records are stored in browser `localStorage`; there is no server, authentication, shared workspace, backup, or encryption in this prototype. Do not import confidential, personal, or regulated information. Use validated, consented research data and confirm local privacy and regulatory requirements before publishing findings.

# Leverage
# Leverage

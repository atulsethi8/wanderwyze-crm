# Stable Checkpoint v3.1 – 2025-09-09

Scope of changes captured in this checkpoint:

- Service Charge support
  - Added `serviceCharge { netCost, grossBilled }` to `Itinerary` in `types.ts`.
  - Initialized default in `constants.ts` (`INITIAL_ITINERARY`).
  - Added Service Charge UI section in `components/DocketForm.tsx` under Itinerary.
  - Financial Summary now includes Service Charge in totals and profit.
  - `InvoiceGenerator` now auto-adds a "Service Charge" line item based on itinerary.
  - `DocketForm` passes live `formState` to the invoice modal so unsaved edits (including Service Charge) populate invoices.

- Leads bugfix
  - Creation error "invalid input syntax for type date: \"\"" fixed by normalizing blank dates to NULL and defaulting `created_date` to today in `services/leadService.ts`.
  - Improved error surfaced in `components/LeadsPipeline.tsx` when createLead fails.

How to roll back to this checkpoint:
- Revert to this commit or re-apply the files listed above if needed.

Files changed in this checkpoint:
- `types.ts`
- `constants.ts`
- `components/DocketForm.tsx`
- `components/InvoiceGenerator.tsx`
- `components/LeadsPipeline.tsx`
- `services/leadService.ts`

Notes:
- If your `dockets` table stores `itinerary` as JSONB, no schema migration is required. Otherwise, add optional numeric columns `service_charge_net` and `service_charge_gross` if you prefer column storage.
- For Leads tables, ensure schema matches `database-schema-leads-safe-migration.sql` and `database-schema-leads-add-nights-column.sql`.

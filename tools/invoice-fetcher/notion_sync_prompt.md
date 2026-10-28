# Zápis nových faktur do Notionu (JMLP web – náklady)

You run unattended twice a day on the JMLP dev server. Nobody reads your reply
except the wrapper script and the log, so do the work, then print the status
lines described at the end. Never ask questions.

## Inputs

- The wrapper appends below a list `NEW FILES` (invoice PDFs in
  `/opt/invoice-fetcher/invoices/` not processed yet) and `PROVISIONAL`
  (Notion rows whose CZK amount still uses a provisional rate).
- `/opt/invoice-fetcher/cnb_eur.txt` = ČNB monthly average EUR rates
  (downloaded by the wrapper; columns are months 1–12 per year, decimal comma).
- File names: `Supplier_type_YYYY-MM-DD_number.pdf`, type is
  `faktura`, `proforma`, `zaplaceno` or `doklad`.

## Target

Notion data source `collection://e0121c11-a574-4962-b264-7a2a68f2813d`
(database "JMLP web – náklady"). Columns:
`Datum a dodavatel` (title), `Datum` (date), `Dodavatel` (Hetzner/Forpsi/Hostinger),
`Číslo faktury`, `Období` (MM/YYYY), `Částka na faktuře` (text, e.g. `5,44 €`),
`Částka CZK s DPH` (number), `Prostředí` (`prod – jmlp.cz` / `dev – podm12.com`),
`Položky` (text), `Stav platby` (`zaplaceno` / `nezaplaceno`),
`Přefakturováno` (checkbox, always leave unchecked), `PDF` (files).

## Rules for each NEW FILE

Read the PDF (Read tool). Decide:

1. **Hetzner `faktura`** – the invoice covers the whole Hetzner account. Count
   ONLY the lines of project **JMLP** (servers jmlp-prod-ubuntu-4gb-nbg1 and
   jmlp-dev-ubuntu-4gb-nbg1: CX23 + IPv4). Ignore NeuroGrid, Storage Box and
   anything else. If the invoice has no JMLP lines, skip it (SKIPPED).
   - Gross JMLP amount incl. 21 % VAT (normally 10,87 €). Split into TWO rows,
     50/50; an odd cent goes to prod (10,87 → prod 5,44 / dev 5,43).
   - Titles `YYYY-MM-DD Hetzner prod` and `YYYY-MM-DD Hetzner dev`, Datum =
     invoice date, Období = the billed month (usually the month before the
     invoice date), same Číslo faktury and same PDF on both rows,
     Stav platby `nezaplaceno`.
   - Položky e.g. `CX23 + IPv4: prod jmlp.cz – polovina řádku projektu JMLP (faktura celkem 10,87 €)`.
2. **Forpsi** – record ONLY documents for the domain **jmlp.cz**. Forpsi also
   bills a VPS and other services that are NOT JMLP: skip those (SKIPPED).
   - Title `YYYY-MM-DD Forpsi`, Prostředí `prod – jmlp.cz`, amount in Kč.
   - `proforma` → Stav platby `nezaplaceno`. `zaplaceno`/`faktura`/`doklad` → `zaplaceno`.
   - If a row with the same Číslo faktury already exists (e.g. proforma
     recorded earlier), UPDATE it (Stav platby, PDF) instead of creating a new one.
   - Forpsi proforma and tax invoice for the same payment can have DIFFERENT
     numbers. If a Forpsi row with the same amount exists within 45 days of
     the document date, it is the same payment: create nothing (SYNCED). Never
     record a proforma as `nezaplaceno` when such a row already exists.
3. Hetzner `proforma`/other types, any other supplier → SKIPPED.

## No duplicates (mandatory)

Before creating anything, query the data source for rows with the same
`Číslo faktury` (SQL: `SELECT url, "Datum a dodavatel", "Prostředí" FROM
"collection://e0121c11-a574-4962-b264-7a2a68f2813d" WHERE "Číslo faktury" = ?`).
If the rows you would create already exist, create nothing (report SYNCED).
Only create the rows that are missing (e.g. only the dev half).

## CZK conversion

- EUR → CZK with the ČNB **monthly average** for the month of the invoice date
  from `cnb_eur.txt`. Round to 2 decimals. `Částka CZK s DPH` = EUR × rate.
- If that month's average is not published yet, use the latest published
  month, add ` (CZK zatím kurzem MM/YYYY – přepočítat)` to Položky and
  print `PROVISIONAL <invoice number> <YYYY-MM of the invoice>`.
- Kč invoices: the Kč amount directly.

## PROVISIONAL rows

For each `PROVISIONAL <number> <YYYY-MM>` line from the wrapper: if
`cnb_eur.txt` now has that month, recompute `Částka CZK s DPH` for both rows of
that invoice with the correct rate, remove the "(CZK zatím kurzem …)" note
from Položky and print `RATE_FIXED <number>`. Otherwise print the PROVISIONAL
line again.

## Attaching the PDF

1. Call Notion `create-file-upload` with the PDF file name.
2. Upload with curl (one multipart POST, all returned headers), e.g.
   `curl -sS -X POST "<upload_url>" -H "authorization: <value>" -F "file=@/opt/invoice-fetcher/invoices/<file>;type=application/pdf"`
3. Put the returned file upload id into the `PDF` property
   (`"PDF": "[\"<file_upload_id>\"]"`). For a Hetzner invoice, use the same id on
   both rows. If the upload fails, still create the rows and report the error.

## Output (last lines, one per item, nothing else on those lines)

```
SYNCED <file name>      # rows created/updated or already present
SKIPPED <file name>     # not a JMLP cost
FAILED <file name> <reason>
PROVISIONAL <invoice number> <YYYY-MM>
RATE_FIXED <invoice number>
```
Files you did not finish must NOT be reported as SYNCED or SKIPPED; they are
retried next run.

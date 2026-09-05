# Industrial Shopfloor Production & OEE Loss Tracker

A web application designed for precision machine shops and CNC/VMC/HMC production lines. It tracks shift output, multi-part cycle times, operator performance, and 13 specific downtime losses across 11 shopfloor machines, featuring an automated OEE & Loss Occurrence Dashboard.

This repository is organized as a static web app at the project root:
`index.html`, `assets/`, `css/`, `js/`, `supabase/`, and `manifest.json`.

---

## 🏭 11 Shopfloor Machines
1. **CNC DX 200-1** (CNC Turning Center)
2. **CNC 200-2** (CNC Turning Center)
3. **CNC DX 250** (CNC Heavy Lathe)
4. **CNC DX12B** (Precision Lathe)
5. **VMC 1050** (Vertical Machining Center)
6. **VMC 1880** (Heavy Bed Milling Center)
7. **VMC 850** (Vertical Machining Center)
8. **VMC HAAS** (HAAS High Precision Vertical Center)
9. **VMC PX 20** (Compact Milling Center)
10. **HMC 1** (Horizontal Machining Center)
11. **HMC 2** (Horizontal Machining Center)

---

## 🧭 3-Page Workflow

### Page 1: Minimalist Machine Launchpad
- Clean, uncluttered view displaying **only the 11 machine names**.
- Hover lift and glowing accent micro-animations.
- Clicking any machine immediately opens **Page 2** pre-configured for that machine.

### Page 2: Dedicated Machine Production & 13-Loss Fill-up Tab
- **Shift & Operator Parameters**: Date, Shift (`Shift A`, `Shift B`, `Shift C`), Shift Hours (`8.5 hrs / 510 mins` or `7.0 hrs / 420 mins`), Operator Name.
- **Multi-Part Production Details**:
  - **Part Number 1**: Name/Number, Cycle Time (mins), Quantity Produced
  - **Part Number 2**: Name/Number, Cycle Time (mins), Quantity Produced
  - **Part Number 3**: Name/Number, Cycle Time (mins), Quantity Produced
  - Total Scrap / Rejected Quantity
- **13 Standard Loss Categories (in Minutes)**:
  1. `Breakdown Loss`
  2. `No Plan`
  3. `No Material`
  4. `No Operator`
  5. `Start Up`
  6. `Setup`
  7. `Jig & Fixture Issue`
  8. `Programming Loss`
  9. `Measurement & Adjustment`
  10. `Document Loss`
  11. `Speed Loss`
  12. `Quality Inspection`
  13. `Cleaning`
  - **Remarks / Root Cause** ("Why did loss occur") textarea.
- **Live Auto-Calculated Ribbon**: Live calculation of Planned Time, Total Losses, Net Operating Time, Availability (A), Performance (P), Quality (Q), and Overall OEE (%).
- "Save Record & View Dashboard" button saves the entry and transitions directly to Page 3.

### Page 3: Executive OEE & Loss Occurrence Dashboard
- Automated visual analytics powered by **Chart.js**:
  - **Mathematical OEE Standard**:
    $$\text{Availability (A)} = \frac{\text{Operating Time}}{\text{Planned Shift Time}} \times 100$$
    $$\text{Performance (P)} = \frac{\sum (\text{Cycle Time}_i \times \text{Quantity}_i)}{\text{Operating Time}} \times 100$$
    $$\text{Quality (Q)} = \frac{\text{Good Parts}}{\text{Total Parts Produced}} \times 100$$
    $$\text{OEE (\%)} = \frac{A \times P \times Q}{10000}$$
- **4 KPI Metric Cards**: Overall Line OEE, Availability (A), Performance (P), Quality (Q).
- **Pareto Bar Chart**: Duration ranking across all 13 loss categories.
- **Loss Classification Donut Chart**: Breakdown of downtime into functional areas (Equipment, Process/Setup, Logistics, Quality, Maintenance).
- **Line Performance Comparison Bar Chart**: OEE % across all 11 machines.
- **"Why Does Loss Occur?" Root-Cause Log Table**: Qualitative audit of operator remarks and causes by machine and shift.

---

## ⚡ Local Preview

This app is now env-driven for Supabase, so the clean local workflow is Vercel's dev server.

Recommended local options:
```bash
npx vercel dev
```
or
```bash
npx vercel dev --listen 3000
```

Then open the local URL shown by Vercel. Add a `.env.local` file with `VERCEL_SUPABASE_URL` and `VERCEL_SUPABASE_ANON_KEY` for local testing.

## 🚀 Deployment

Deploy the repository root directly to Vercel.

Deployment checklist:
1. Keep the root files exactly as they are now.
2. Ensure `index.html` remains at the host root.
3. Verify the CDN links for Supabase and Chart.js are reachable in production.
4. In Vercel, add `VERCEL_SUPABASE_URL` and `VERCEL_SUPABASE_ANON_KEY` as environment variables.
5. Run `supabase/schema.sql` once in your Supabase SQL editor before using live data.

### Vercel Setup

1. Import the repository into Vercel.
2. Leave the build command empty unless you later add a bundler.
3. Set the output root to the repository root.
4. Add `VERCEL_SUPABASE_URL` and `VERCEL_SUPABASE_ANON_KEY` in the project environment settings.
5. Deploy once, then verify that saving and dashboard loading work against Supabase.
6. For local development, use `npx vercel dev` with the same `.env.local` values.
7. If you want to apply the schema directly, run `supabase/schema.sql` in the Supabase SQL Editor. This environment cannot push schema changes with only the anon key.

### Production Notes

1. Do not commit Supabase credentials to git.
2. The Clear Data button now only resets local browser cache, which is safer for a shared deployment.
3. For stricter multi-user control, add Supabase Auth and admin-only actions later.

---

## 🗄️ Supabase Cloud Database Integration

1. Log into your [Supabase Dashboard](https://supabase.com).
2. Open the **SQL Editor** tab.
3. Paste the contents of `supabase/schema.sql` and click **Run**.
4. Add `VERCEL_SUPABASE_URL` and `VERCEL_SUPABASE_ANON_KEY` in Vercel or `.env.local`.
5. Once connected, the header will display **"🟢 Supabase: Connected"**, and every new production entry is stored live in your Supabase PostgreSQL cloud database.

---

## 🧹 Clearing Data for Fresh Production Entry

- Click the **"Clear Data"** button in the header at any time.
- This resets all stored production entries, zeros the live dashboard, and clears the production form so you can immediately begin recording fresh machine shifts without old sample data.

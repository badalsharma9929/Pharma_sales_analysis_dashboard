# Pharma Sales & Field Force Analytics — Build-From-Scratch Project Brief

> **Hand-off specification for an AI build agent**
> Build a Next.js dashboard from zero, on top of a fabricated (~100K-row) India-pharma dataset, that delivers five analysis modules and eight chart types.

**Tags:** Next.js · TypeScript · Prisma · Recharts · India pharma · fabricated dataset · analytics dashboard
**Version:** 1.0
**Date:** 2026-06-20

---

## 0. Executive TL;DR (read this first)

You are building a **single-deployable Next.js 15 dashboard** that visualizes sales-and-field-force performance for a fictional Indian pharmaceutical company called **"MedLife Pharma Pvt. Ltd."**. The dashboard is fed by a **fabricated (fab) dataset of ~100K rows across 7 relational tables** that you must first generate using a Python script, then seed into a Prisma-managed SQLite database.

The dashboard must implement **5 analysis modules** — Sales Performance, Field Force Activity, HCP Targeting, Product & Portfolio Mix, and Forecasting — and render **8 mandatory chart types** — KPI cards, sales trend lines, India geo/region map, rep leaderboard, scatter ROI, funnel/coverage, product pie/treemap, and calendar heatmap.

The project must be runnable end-to-end with three commands: `npm install`, `npm run seed` (which both generates the dataset and seeds the DB), and `npm run dev`. The deliverable is a polished, responsive web dashboard plus a clean repo with a README that explains the build.

**You are allowed to make sensible engineering decisions** (exact chart library minor versions, folder structure within `/app`, color palette within bounds). When you make such a decision, document it in the README under "Agent Decisions". The only hard constraints are: stack (Next.js + Prisma + SQLite), dataset shape (7 tables, ~100K rows, India locale), 5 modules, 8 chart types, RNG seed = 42 for reproducibility.

---

## 1. Project Goals & Success Criteria

### 1.1 Business Problem

Sales leadership at a mid-sized Indian pharmaceutical company currently lacks a single, real-time view of how its field force is performing. Data lives in three disconnected systems: the CRM (which records doctor visits and call details), the ERP (which records invoices to distributors and stockists), and an expense system (which records travel & entertainment claims). Quarterly reviews take two weeks of manual Excel wrangling, and by the time the deck is ready, the data is stale.

The brief asks the agent to simulate this entire ecosystem with a single fabricated dataset, then build a self-serve dashboard that any sales leader can open in a browser to answer five recurring questions: *How are we tracking against target? Are my reps covering the right doctors? Are we over-indexed on one product? Where will next quarter land? Which HCPs are slipping through the cracks?*

### 1.2 Target Users

The dashboard has three primary user personas. The **National Sales Head** opens the Overview page first thing every Monday morning to check last week's attainment and YoY trajectory. The **Regional Manager** drills into their zone filter to see which reps and HCPs are underperforming. The **Sales Operations analyst** uses the Field Force and HCP Targeting pages to plan next quarter's call plan and rep territory reassignment.

### 1.3 Success Criteria

1. The fabricated dataset covers 36 months (April 2023 → March 2026), contains ≥ 100K total rows across 7 tables, and is fully reproducible from a single Python script with `random_state = 42`.
2. The dashboard runs locally with one command, loads any page in under 2 seconds on a 2020 MacBook Air, and renders cleanly on both 1440p desktop and 1280×800 laptop.
3. All 5 analysis modules are accessible from the sidebar, and every module page surfaces at least 2 of the 8 mandated chart types.
4. All 8 chart types appear at least once across the dashboard, with working hover tooltips and responsive resize.
5. The README explains dataset generation, seeding, dev startup, and every non-obvious decision the agent made.

---

## 2. Tech Stack & Architecture

### 2.1 Stack Snapshot

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15 (App Router) | Server Components for data fetching, RSC streaming, file-based routing |
| Language | TypeScript (strict) | Type safety end-to-end from Prisma → API → component |
| Styling | Tailwind CSS 4 + shadcn/ui | Utility-first + accessible primitives, no custom CSS framework needed |
| Charts | Recharts (primary) + react-simple-maps (geo) | Recharts covers 7 of 8 chart types; react-simple-maps for the India choropleth |
| Database | Prisma ORM + SQLite (file-based) | Zero-infra, schema-first, type-safe client. Switch to Postgres later if needed. |
| Data generation | Python 3.11 + pandas + numpy + faker | Faker has an `en_IN` locale for Indian names, cities, phone numbers |
| Date handling | date-fns | Tree-shakeable, immutable |
| State | URL search params (nuqs) + React server-state | Filters stored in URL so they're shareable and bookmarkable |

### 2.2 Folder Structure

```
pharma-sales-dashboard/
├── app/
│   ├── (dashboard)/
│   │   ├── layout.tsx           # sidebar + topbar shell
│   │   ├── page.tsx             # Overview
│   │   ├── sales/page.tsx
│   │   ├── field-force/page.tsx
│   │   ├── hcp-targeting/page.tsx
│   │   ├── product-mix/page.tsx
│   │   └── forecast/page.tsx
│   ├── api/
│   │   ├── overview/route.ts
│   │   ├── sales/route.ts
│   │   ├── field-force/route.ts
│   │   ├── hcp/route.ts
│   │   ├── product/route.ts
│   │   └── forecast/route.ts
│   └── layout.tsx               # root layout, fonts, providers
├── components/
│   ├── ui/                      # shadcn/ui primitives
│   ├── charts/                  # one file per chart type
│   ├── filters/                 # GlobalFilters, DateRangePicker
│   └── layout/                  # Sidebar, Topbar, PageHeader
├── lib/
│   ├── db.ts                    # Prisma client singleton
│   ├── analytics/               # one fn per analysis module
│   ├── types.ts
│   └── utils.ts
├── prisma/
│   ├── schema.prisma
│   └── seed.ts                  # loads CSVs from /data
├── scripts/
│   └── generate_dataset.py      # writes 7 CSVs to /data
├── data/                        # generated CSVs (gitignored)
├── public/
│   └── india-states.topo.json   # for the geo map
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
└── README.md
```

### 2.3 Data Flow

Server Components fetch from Prisma directly (no API needed for first render). API routes exist for two reasons: (a) to power client-side filter changes without losing server cache, and (b) to expose a clean JSON contract if the dashboard is ever embedded elsewhere. Every chart component is a client component (`"use client"`) that takes typed data as props — never fetches its own data.

---

## 3. Fab Dataset — Overview & Conventions

### 3.1 Scope

The dataset simulates **36 months** of operations for MedLife Pharma, a fictional mid-sized Indian pharmaceutical company, covering fiscal years **FY24, FY25, FY26** (Indian fiscal year = April → March). The company has roughly 50 field reps organized into 4 zones, calls on about 3,000 doctors (HCPs) across 12 major Indian cities, and sells 12 products across 4 therapy areas. Total row count across all 7 tables should land between **100K and 120K rows**.

### 3.2 Naming & Format Conventions

| Convention | Rule |
|---|---|
| Column names | snake_case, singular (`rep_id`, not `repId` or `reps_id`) |
| Date format | ISO 8601 string `YYYY-MM-DD` in CSVs, `DateTime` in Prisma |
| Currency | INR (Indian Rupee), stored as paise integers (1 INR = 100 paise) to avoid float drift — display layer divides by 100 |
| IDs | String-prefixed codes: `REP-001`, `HCP-0001`, `PRD-CARD-01`, `VIS-20240105-001`, `INV-20240105-001`, `EXP-20240105-001`, `TGT-2024-Q1-REP001-PRDCARD01` |
| NULL handling | Empty string in CSVs (Prisma maps to `null`) |
| Booleans | `true`/`false` literal in CSVs |
| RNG seed | `random_state = 42` everywhere (numpy, faker, pandas) |
| File names | `reps.csv`, `hcps.csv`, `products.csv`, `visits.csv`, `sales.csv`, `expenses.csv`, `targets.csv` |

### 3.3 Locale Specifics

All names must come from Faker's `en_IN` locale so the dashboard reads naturally to an Indian user: first names like *Aarav*, *Priyanka*, *Vignesh*; last names like *Sharma*, *Iyer*, *Reddy*; cities limited to **Mumbai, Delhi, Bengaluru, Chennai, Kolkata, Hyderabad, Pune, Ahmedabad, Jaipur, Lucknow, Kochi, Bhopal**. Phone numbers in `+91-XXXXXXXXXX` format. States restricted to the 28 Indian states + 8 UTs.

---

## 4. Fab Dataset — Entity Schemas (7 Tables)

### 4.1 `reps` (~50 rows)

| Column | Dtype | Description | Constraints |
|---|---|---|---|
| `rep_id` | string | Primary key, format `REP-001`…`REP-050` | unique, not null |
| `first_name` | string | Rep first name (Faker en_IN) | not null |
| `last_name` | string | Rep last name | not null |
| `email` | string | `firstname.lastname@medlife.in` | unique |
| `phone` | string | `+91-XXXXXXXXXX` | not null |
| `role` | enum | `Field_Rep` (40), `Area_Manager` (8), `Regional_Manager` (4), `National_Head` (1) — total ~53, rounded to 50 | not null |
| `manager_id` | string | FK → `reps.rep_id`; null for National Head | nullable |
| `zone` | enum | `North`, `South`, `East`, `West` | not null |
| `state` | string | Indian state within the zone | not null |
| `city` | string | HQ city | not null |
| `hire_date` | date | When the rep joined (range: 2020-01-01 → 2025-12-31) | not null |
| `exit_date` | date | When the rep exited, null if still active | nullable |
| `status` | enum | `Active`, `On_Leave`, `Exited` | not null |
| `base_salary_inr` | integer | Annual base in INR (Field_Rep: 6-9L, AM: 12-16L, RM: 22-28L, NH: 50-60L) | not null |
| `target_stretch_pct` | float | Personal stretch multiplier applied to targets (0.9 → 1.2) | not null |

### 4.2 `hcps` (~3,000 rows)

| Column | Dtype | Description | Constraints |
|---|---|---|---|
| `hcp_id` | string | Primary key, `HCP-0001`…`HCP-3000` | unique |
| `first_name` | string | Doctor first name | not null |
| `last_name` | string | Doctor last name | not null |
| `specialty` | enum | `Cardiologist`, `Diabetologist`, `Gastroenterologist`, `Pulmonist`, `GP`, `Consultant_Physician` | not null |
| `tier` | enum | `A` (top 20%, high-prescribers), `B` (mid 50%), `C` (long-tail 30%) | not null |
| `decile` | int | 1-10 revenue decile, recomputed quarterly (1 = top) | not null |
| `city` | string | One of the 12 cities | not null |
| `state` | string | State of the city | not null |
| `zone` | enum | Derived from state (see Appendix D) | not null |
| `hospital` | string | Affiliated hospital/clinic name | nullable |
| `years_practicing` | int | 2 → 40 | not null |
| `preferred_contact` | enum | `Clinic`, `Hospital`, `Phone`, `WhatsApp` | not null |
| `npi_like_id` | string | Fictional MCI-style reg number `MCI-XXXXX` | unique |

### 4.3 `products` (12 rows)

| Column | Dtype | Description | Constraints |
|---|---|---|---|
| `product_id` | string | Primary key, `PRD-CARD-01`, `PRD-DIAB-02`, etc. | unique |
| `product_name` | string | Brand name (e.g., `Cardiolex`, `Glucoflex`) | not null |
| `molecule` | string | Active molecule (e.g., `Atorvastatin`) | not null |
| `therapy_area` | enum | `Cardio`, `Diabetes`, `GI`, `Respiratory` | not null |
| `launch_date` | date | Some products launched during the 36-month window | not null |
| `mrp_inr` | integer | Maximum retail price per pack (₹50 → ₹1,500) | not null |
| `pack_size` | int | Tablets/capsules per pack (10, 15, 30, 100) | not null |
| `is_new_launch` | bool | True if launch_date is within the 36-month window | not null |
| `priority` | enum | `Strategic`, `Growth`, `Maintain`, `Harvest` | not null |

### 4.4 `visits` (~60K rows)

| Column | Dtype | Description | Constraints |
|---|---|---|---|
| `visit_id` | string | Primary key, `VIS-YYYYMMDD-NNN` | unique |
| `rep_id` | string | FK → `reps.rep_id` | not null |
| `hcp_id` | string | FK → `hcps.hcp_id` | not null |
| `visit_date` | date | Weekday only (Mon-Sat), excluding Indian holidays | not null |
| `visit_type` | enum | `F2F`, `Virtual`, `Group_Detailing`, `Conference` | not null |
| `duration_min` | int | 5 → 60, weighted toward 15-20 | not null |
| `products_detailed` | string | Comma-separated product_ids (1 → 3 products per visit) | not null |
| `samples_dropped` | int | 0 → 20 | not null |
| `outcome` | enum | `Detailed`, `Briefed`, `No_Show`, `Refused` | not null |
| `followup_required` | bool | True ~25% of the time | not null |

### 4.5 `sales` (~30K rows)

| Column | Dtype | Description | Constraints |
|---|---|---|---|
| `invoice_id` | string | Primary key, `INV-YYYYMMDD-NNN` | unique |
| `distributor_id` | string | `DIST-001`…`DIST-040` | not null |
| `rep_id` | string | FK → reps (rep who covers that HCP) | not null |
| `hcp_id` | string | FK → hcps (prescribing HCP) | not null |
| `product_id` | string | FK → products | not null |
| `qty_packs` | int | 1 → 200 | not null |
| `unit_price_inr` | integer | Effective unit price (≤ MRP; ~85% of MRP after distributor margin) | not null |
| `discount_pct` | float | 0 → 15% | not null |
| `net_value_inr` | integer | `qty_packs * unit_price_inr * (1 - discount_pct)` | not null |
| `invoice_date` | date | Aligned to visit_date ± 14 days | not null |
| `channel` | enum | `Stockist`, `Retail`, `Hospital`, `Institution` | not null |

### 4.6 `expenses` (~10K rows)

| Column | Dtype | Description | Constraints |
|---|---|---|---|
| `expense_id` | string | Primary key, `EXP-YYYYMMDD-NNN` | unique |
| `rep_id` | string | FK → reps | not null |
| `expense_date` | date | Date expense was incurred | not null |
| `category` | enum | `Travel`, `Food`, `Lodging`, `Samples`, `Conference`, `Mobile`, `Other` | not null |
| `amount_inr` | integer | 50 → 5,000 per entry | not null |
| `reimbursed` | bool | ~90% true | not null |
| `policy_compliant` | bool | ~95% true | not null |
| `notes` | string | Short free-text description | nullable |

### 4.7 `targets` (~3,600 rows)

| Column | Dtype | Description | Constraints |
|---|---|---|---|
| `target_id` | string | Primary key, `TGT-YYYYQn-REPxxx-PRDxxx` | unique |
| `rep_id` | string | FK → reps | not null |
| `product_id` | string | FK → products | not null |
| `fy` | int | Fiscal year (2024, 2025, 2026) | not null |
| `quarter` | enum | `Q1`, `Q2`, `Q3`, `Q4` | not null |
| `target_qty` | int | Quarterly target in packs | not null |
| `target_value_inr` | integer | Quarterly target in INR | not null |

Computation: 50 reps × 12 products × 12 quarters = 7,200 rows. Adjust to ~3,600 by dropping products outside the rep's therapy-area focus (each rep covers ~6 products).

---

## 5. Fab Dataset — Relationships (ERD)

The dataset is a classic star/snowflake schema with `reps` as the central hub. Below is the textual ERD; implement exactly these relations in Prisma.

| From | To | Cardinality | Via |
|---|---|---|---|
| `reps` | `reps` (manager) | 1 : N | `reps.manager_id` self-reference |
| `reps` | `visits` | 1 : N | `visits.rep_id` |
| `reps` | `sales` | 1 : N | `sales.rep_id` |
| `reps` | `expenses` | 1 : N | `expenses.rep_id` |
| `reps` | `targets` | 1 : N | `targets.rep_id` |
| `hcps` | `visits` | 1 : N | `visits.hcp_id` |
| `hcps` | `sales` | 1 : N | `sales.hcp_id` |
| `products` | `visits` | 1 : N (via junction string) | `visits.products_detailed` (denormalized CSV — parse in app layer) |
| `products` | `sales` | 1 : N | `sales.product_id` |
| `products` | `targets` | 1 : N | `targets.product_id` |

The `products_detailed` field is intentionally a CSV string inside `visits` rather than a proper junction table — this keeps the schema lean for a demo project and matches how most pharma CRMs export the field. The app layer must split on `,` and join to `products` as needed.

---

## 6. Fab Dataset — Generation Rules & Distributions

### 6.1 Reps

Generate 50 reps with the hierarchy: 1 National Head → 4 Regional Managers (one per zone) → 8 Area Managers (2 per zone) → ~37 Field Reps (4-5 per area). `hire_date` is uniformly distributed across 2020-01-01 → 2025-12-31, biased toward the middle. Apply **12% annual attrition** — each rep has a 12% chance per year of being marked `Exited` with an `exit_date` somewhere mid-year. Exited reps get replaced by a new rep with `hire_date` = old rep's `exit_date + ~14 days` to maintain coverage.

### 6.2 HCPs

3,000 HCPs, distributed across cities proportional to population (Mumbai ~15%, Delhi ~14%, Bengaluru ~11%, etc.). Tier distribution: **A = 20%, B = 50%, C = 30%**. Specialty correlated with therapy area focus: 30% Cardiologists, 30% Diabetologists, 20% Gastroenterologists, 20% Pulmonists. Decile recomputed each quarter based on cumulative revenue.

### 6.3 Visits

Each active Field Rep executes **8-12 visits per working day** (Mon-Sat). Working days = total days minus Sundays minus Indian national holidays minus state-specific holidays. Visit-to-HCP assignment is biased: Tier-A HCPs get visited ~3× per month, Tier-B ~1.5×/month, Tier-C ~0.5×/month. Visit type mix: 70% F2F, 15% Virtual, 10% Group_Detailing, 5% Conference. Outcome distribution: 60% Detailed, 25% Briefed, 10% No_Show, 5% Refused. Sample drop counts scale with HCP tier (A gets more samples).

### 6.4 Sales

Each Tier-A HCP generates ~2 invoices per month, Tier-B ~1/month, Tier-C ~0.3/month. Invoice value follows a **lognormal distribution** with mean driven by product MRP and HCP tier. Monthly seasonality: peaks in **March (fiscal close)** and **September (festive + half-year close)** at 1.3× baseline; dips in **May (summer slowdown)** at 0.85×. Apply an **8% YoY growth** baseline. New products follow a **6-month linear ramp** from launch date to steady-state. Discounts uniformly 2-12%.

### 6.5 Expenses

Each rep incurs ~5-8 expense entries per week. Travel 40%, Food 25%, Lodging 15%, Samples 10%, Other 10%. Amounts: Travel ₹200-₹2,000, Food ₹100-₹800, Lodging ₹1,500-₹4,000. Policy compliance ~95%; non-compliant flagged.

### 6.6 Targets

Targets are computed **bottom-up from last year's actuals × growth × stretch**: `target_qty = last_year_actual_qty × 1.15 × rep.target_stretch_pct`. For new products, base on therapeutic-area average. Targets stored at quarter granularity per rep per product.

### 6.7 Reproducibility

Set `numpy.random.seed(42)`, `faker.seed_instance(42)`, `random.seed(42)` at the top of the generation script. The same seed must always produce byte-identical CSVs.

---

## 7. Fab Dataset — Sample Rows

### 7.1 `reps.csv`
```
rep_id,first_name,last_name,email,phone,role,manager_id,zone,state,city,hire_date,exit_date,status,base_salary_inr,target_stretch_pct
REP-001,Aarav,Sharma,aarav.sharma@medlife.in,+91-9820012345,National_Head,,North,Delhi,Delhi,2020-04-01,,Active,5500000,1.20
REP-002,Priyanka,Iyer,priyanka.iyer@medlife.in,+91-9840123456,Regional_Manager,REP-001,South,Tamil Nadu,Chennai,2020-06-15,,Active,2500000,1.10
REP-013,Vignesh,Reddy,vignesh.reddy@medlife.in,+91-9003012345,Field_Rep,REP-007,South,Telangana,Hyderabad,2022-03-10,2025-08-15,Exited,720000,1.05
```

### 7.2 `hcps.csv`
```
hcp_id,first_name,last_name,specialty,tier,decile,city,state,zone,hospital,years_practicing,preferred_contact,npi_like_id
HCP-0001,Anil,Kumar,Cardiologist,A,1,Mumbai,Maharashtra,West,Lilavati Hospital,18,Clinic,MCI-10231
HCP-0002,Meena,Nair,Diabetologist,B,5,Kochi,Kerala,South,Aster Medcity,12,Hospital,MCI-10552
HCP-0003,Rajesh,Gupta,GP,C,9,Jaipur,Rajasthan,North,Gupta Clinic,7,Phone,MCI-10893
```

### 7.3 `products.csv`
```
product_id,product_name,molecule,therapy_area,launch_date,mrp_inr,pack_size,is_new_launch,priority
PRD-CARD-01,Cardiolex,Atorvastatin,Cardio,2018-04-01,350,10,false,Maintain
PRD-DIAB-02,Glucoflex,Metformin,Diabetes,2018-06-01,120,15,false,Maintain
PRD-CARD-03,Vasoclear,Rosuvastatin,Cardio,2024-09-15,680,10,true,Strategic
```

### 7.4 `visits.csv`
```
visit_id,rep_id,hcp_id,visit_date,visit_type,duration_min,products_detailed,samples_dropped,outcome,followup_required
VIS-20240105-001,REP-013,HCP-0001,2024-01-05,F2F,18,PRD-CARD-01,5,Detailing,true
VIS-20240105-002,REP-013,HCP-0003,2024-01-05,F2F,12,PRD-CARD-01|PRD-DIAB-02,2,Briefed,false
```

### 7.5 `sales.csv`
```
invoice_id,distributor_id,rep_id,hcp_id,product_id,qty_packs,unit_price_inr,discount_pct,net_value_inr,invoice_date,channel
INV-20240108-001,DIST-007,REP-013,HCP-0001,PRD-CARD-01,12,297,5.0,338580,2024-01-08,Hospital
INV-20240109-002,DIST-007,REP-013,HCP-0001,PRD-DIAB-02,8,102,8.0,75168,2024-01-09,Stockist
```

### 7.6 `expenses.csv`
```
expense_id,rep_id,expense_date,category,amount_inr,reimbursed,policy_compliant,notes
EXP-20240105-001,REP-013,2024-01-05,Travel,650,true,true,Cab to Lilavati Hospital
EXP-20240105-002,REP-013,2024-01-05,Food,340,true,true,Team lunch with HCP-0001
EXP-20240106-003,REP-013,2024-01-06,Lodging,3200,true,false,5-star hotel — policy max 2500
```

### 7.7 `targets.csv`
```
target_id,rep_id,product_id,fy,quarter,target_qty,target_value_inr
TGT-2024-Q1-REP013-PRDCARD01,REP-013,PRD-CARD-01,2024,Q1,120,3564000
TGT-2024-Q1-REP013-PRDDIAB02,REP-013,PRD-DIAB-02,2024,Q1,80,912000
```

---

## 8. Analysis Module 1 — Sales Performance

### 8.1 Metrics to Compute

| Metric | Formula | Granularity |
|---|---|---|
| Total Sales (₹ Cr) | `SUM(net_value_inr) / 1e7` | Daily / Monthly / Quarterly |
| Attainment % | `SUM(actual) / SUM(target) × 100` | Per rep, per zone, per product |
| YoY Growth % | `(current_period - prior_year_period) / prior_year_period × 100` | Monthly |
| MoM Growth % | `(current_month - prior_month) / prior_month × 100` | Monthly |
| Sales by Zone | `SUM(net_value_inr) GROUP BY zone` | Monthly |
| Sales by Therapy Area | `SUM(net_value_inr) GROUP BY products.therapy_area` | Monthly |
| Top 10 Reps by Attainment | `ORDER BY attainment_pct DESC LIMIT 10` | Quarterly |
| Bottom 10 Reps by Attainment | `ORDER BY attainment_pct ASC LIMIT 10` | Quarterly |
| Top 10 HCPs by Revenue | `SUM(net_value_inr) GROUP BY hcp_id ORDER BY DESC LIMIT 10` | Quarterly |
| District/State Heat | `SUM(net_value_inr) GROUP BY state` | Monthly |

### 8.2 Business Logic Notes

Attainment % must be computed against **same-period targets**, not annual targets. A rep who hit ₹40L of a ₹50L Q1 target shows 80% attainment, regardless of full-year target. YoY growth for new products (launched within last 12 months) should display as `N/A` rather than `infinity` — handle this in the API layer.

---

## 9. Analysis Module 2 — Field Force Activity

### 9.1 Metrics to Compute

| Metric | Formula |
|---|---|
| Total Visits | `COUNT(*) FROM visits WHERE date BETWEEN @start AND @end` |
| Avg Visits / Rep / Day | `total_visits / (active_reps × working_days)` |
| Coverage % | `DISTINCT hcp_id visited / total HCPs targeted × 100` |
| Reach & Frequency | `AVG(visits_per_hcp_per_month)` |
| MCE Compliance % | `mandatory_calls_executed / mandatory_calls_planned × 100` (mandatory = Tier-A HCPs, min 2 calls/month) |
| Samples Distributed | `SUM(samples_dropped)` |
| Visit Type Mix | `COUNT(*) GROUP BY visit_type` |
| Outcome Distribution | `COUNT(*) GROUP BY outcome` |

### 9.2 Calendar Heatmap

Aggregate visits by date for the last 12 months. Render as a GitHub-style calendar heatmap (week on Y, day-of-week on X, color = visit count). This is the signature chart on the Field Force page.

---

## 10. Analysis Module 3 — HCP Targeting & Segmentation

### 10.1 Segmentation Logic

- **Tier** (A/B/C) is set at generation time based on revenue potential.
- **Decile** (1-10) is recomputed quarterly: rank all HCPs by 90-day trailing revenue, bucket into deciles.
- **Segment label** is derived from tier × recency: `Champion` (Tier A, visited ≤30 days), `Loyal` (Tier A, visited 30-90 days), `At Risk` (Tier A, visited >90 days), `Emerging` (Tier B, growing), `Slipping` (Tier B, declining), `Long-tail` (Tier C).

### 10.2 Metrics

| Metric | Formula |
|---|---|
| Tier-wise Coverage % | `DISTINCT hcp_id visited in tier / total in tier × 100` |
| Decile-wise Revenue Contribution | `SUM(revenue) GROUP BY decile / total × 100` |
| Untapped High-Value HCPs | Tier-A HCPs with 0 visits in last 90 days |
| ROI per HCP | `SUM(revenue from HCP) / COUNT(visits to HCP)` |
| HCP Churn (QoQ) | HCPs whose revenue dropped >50% QoQ |

---

## 11. Analysis Module 4 — Product & Portfolio Mix

### 11.1 Metrics

| Metric | Formula |
|---|---|
| Product Contribution % | `product_revenue / total_revenue × 100` |
| SKU Mix within Therapy Area | `SUM(revenue) GROUP BY SKU within therapy_area` |
| New Product Adoption Curve | Monthly revenue of `is_new_launch=true` products since launch_date |
| Top 3 Growing Products | `MAX(MoM growth %) LIMIT 3` |
| Bottom 3 Declining Products | `MIN(MoM growth %) LIMIT 3` |
| Cannibalization Indicator | When new product launches, check if revenue of existing same-therapy product drops >15% in following 60 days |

### 11.2 Visualization

Treemap showing product revenue contribution nested by therapy area → product → SKU. Pie chart for therapy-area split. Adoption curve as a small-multiples line chart.

---

## 12. Analysis Module 5 — Forecasting

### 12.1 Approach

Use **statsmodels Holt-Winters Exponential Smoothing** (trend + seasonality, 12-month seasonality) on monthly revenue per region and per therapy area. Backtest on the last 3 months: train on months 1-33, predict months 34-36, compute **MAPE**. Then retrain on all 36 months and forecast the next 3 months with 80% / 95% confidence intervals.

### 12.2 Output

| Field | Description |
|---|---|
| `forecast_month` | Next 3 months |
| `forecast_value_inr` | Point forecast |
| `ci_80_lower`, `ci_80_upper` | 80% confidence interval |
| `ci_95_lower`, `ci_95_upper` | 95% confidence interval |
| `mape_pct` | Mean Absolute Percentage Error on backtest |

### 12.3 Visualization

Single line chart per region with three segments: actual (solid), backtest prediction (dashed), forecast (dotted with shaded CI band).

---

## 13. Visualization Specs — 8 Chart Types

| # | Chart | Library | Data Shape | Color | Interaction |
|---|---|---|---|---|---|
| 1 | KPI Cards | Custom shadcn Card | `{ label, value, delta, deltaPct, sparkline: number[] }` | accent green/red for delta | hover to reveal sparkline tooltip |
| 2 | Sales Trend Lines | Recharts `<LineChart>` | `{ month: string, actual: number, target: number, priorYear: number }[]` | actual = #0EA5E9, target = #94A3B8 dashed, priorYear = #CBD5E1 | hover crosshair shows all 3 values |
| 3 | India Geo Map | react-simple-maps + topojson | `{ state: string, value: number }[]` | 5-step sequential blue scale | hover shows tooltip with state + value |
| 4 | Rep Leaderboard | Recharts `<BarChart>` horizontal | `{ repName: string, attainmentPct: number }[]` | green ≥100%, amber 80-100%, red <80% | click to drill into rep detail (toast) |
| 5 | Scatter ROI | Recharts `<ScatterChart>` | `{ repName, expense, revenue }[]` | quadrant-coded | hover shows rep name + ROI ratio |
| 6 | Funnel Coverage | Recharts `<Funnel>` or custom | `[{ stage: 'Targeted', value }, { stage: 'Visited', value }, { stage: 'Detailed', value }, { stage: 'Bought', value }]` | gradient blue → green | hover reveals absolute + % of prior stage |
| 7 | Product Pie + Treemap | Recharts `<PieChart>` + `<Treemap>` | therapy-area pie + nested product treemap | therapy-area-coded palette | click pie slice filters treemap |
| 8 | Calendar Heatmap | `react-calendar-heatmap` or custom SVG | `{ date: string, count: int }[]` for last 12 months | 5-step green scale | hover shows date + visit count |

All charts must:
- Render inside a shadcn Card with a title and subtitle
- Include a legend where multiple series exist
- Use `constrained_layout`-equivalent spacing (Tailwind `gap-4`, `p-4`)
- Re-render on filter change without remounting (key by filter hash)
- Be responsive — min-width 280px, max-width container

---

## 14. Dashboard Page Layouts

### 14.1 Overview Page (Home)

Top: 4 KPI cards (Total Sales ₹Cr, Attainment %, Active Reps, Avg Calls/Day). Middle row: Sales Trend Line (full width, 24-month window). Bottom row: India Geo Map (left, 2/3 width) + Rep Leaderboard (right, 1/3 width, top 10).

### 14.2 Sales Performance Page

Top: KPI strip (Total Sales, Attainment, YoY, MoM). Middle: Sales Trend Line with target overlay + prior-year overlay, filterable by zone/therapy area. Bottom: Attainment bar chart (top/bottom 10 reps) + State-wise revenue table (sortable).

### 14.3 Field Force Page

Top: KPI strip (Total Visits, Coverage %, MCE Compliance, Samples). Middle: Calendar Heatmap (last 12 months, full width). Bottom: Visit Type Mix (pie) + Visits per Rep (horizontal bar, top/bottom 10) + Outcome distribution (donut).

### 14.4 HCP Targeting Page

Top: KPI strip (Total HCPs, Tier-A Coverage, Untapped High-Value, Avg ROI/HCP). Middle: Tier-wise coverage bar + Decile-wise revenue contribution stacked bar. Bottom: Untapped HCPs table (Tier-A, 0 visits in 90 days) + HCP churn table.

### 14.5 Product Mix Page

Top: KPI strip (Total Products, New Launches, Top Growing, Top Declining). Middle: Therapy-area Pie + Product Treemap (side-by-side). Bottom: New-product adoption small-multiples + Cannibalization table.

### 14.6 Forecast Page

Top: KPI strip (Next-Quarter Forecast, MAPE, Confidence). Middle: Actual vs Forecast line chart per region (region selector). Bottom: Per-product forecast table with confidence intervals.

### 14.7 Global Filters (Topbar)

A sticky topbar with: Date Range Picker (default = last 12 months), Zone multi-select (All/N/S/E/W), Therapy Area multi-select, Rep Level multi-select (Field_Rep/AM/RM). Filters propagate to all pages via URL search params.

---

## 15. Build Order — 6-Phase Milestones

### Phase 1 — Scaffold (Day 1)

`npx create-next-app@latest pharma-sales-dashboard --typescript --tailwind --app --eslint`. Install shadcn/ui, Recharts, react-simple-maps, Prisma, faker (Python side). Set up `lib/db.ts`, `prisma/schema.prisma`. Acceptance: `npm run dev` boots to a blank page with no errors.

### Phase 2 — Dataset Generation (Day 1-2)

Write `scripts/generate_dataset.py` per Section 6 rules. Output 7 CSVs to `/data`. Acceptance: total row count between 100K-120K, all FKs resolve, RNG seed reproducible, Indian names + cities.

### Phase 3 — Prisma Seed (Day 2)

Map all 7 tables in `schema.prisma`. Write `prisma/seed.ts` that streams CSVs into SQLite via Prisma's `createMany`. Acceptance: `npx prisma db push && npm run seed` populates DB; `npx prisma studio` shows all tables with realistic data.

### Phase 4 — API Routes (Day 3)

Build 6 route handlers: `/api/overview`, `/api/sales`, `/api/field-force`, `/api/hcp`, `/api/product`, `/api/forecast`. Each accepts filter query params and returns typed JSON. Acceptance: every route returns 200 with non-empty payload when called with default filters.

### Phase 5 — Layout Shell + Filters (Day 3-4)

Build sidebar (6 nav links + brand), topbar with global filters, dashboard layout wrapper. Filters stored in URL via `nuqs`. Acceptance: changing a filter updates the URL and triggers data refetch on all pages.

### Phase 6 — Build Each Page (Day 4-6)

One page per day, in this order: Overview → Sales → Field Force → HCP → Product → Forecast. For each: implement KPI strip first, then 2-3 charts, then tables. Acceptance: all 8 chart types appear at least once; every page loads in <2s.

### Phase 7 — Polish + README (Day 6-7)

Add empty-state components, loading skeletons, error boundaries. Write README with: architecture overview, dataset generation steps, dev startup, agent decisions log, known limitations. Acceptance: a fresh clone runs end-to-end with three commands.

---

## 16. Acceptance Criteria / Definition of Done

The project is "done" when **all 20 items** below are true:

1. ✅ `npm install` completes with zero errors on Node 20+
2. ✅ `npm run seed` generates CSVs AND seeds DB in one command
3. ✅ `npm run dev` boots to a working Overview page
4. ✅ Dataset has ≥ 100K rows across 7 tables
5. ✅ All FK relationships enforced (no orphan rows)
6. ✅ RNG seed 42 produces byte-identical CSVs on re-run
7. ✅ Every page loads in <2s on localhost
8. ✅ All 8 chart types render on at least one page
9. ✅ Every chart has a working hover tooltip
10. ✅ Global filters affect every page
11. ✅ All 5 analysis modules are reachable from sidebar
12. ✅ Forecast endpoint returns MAPE and CI bounds
13. ✅ Mobile responsive at 375px width (chart cards stack vertically)
14. ✅ No TypeScript errors (`npm run build` passes)
15. ✅ No console errors on any page
16. ✅ README has run instructions + agent decisions log
17. ✅ Prisma schema matches Section 5 ERD exactly
18. ✅ Currency displays as ₹XX.XX Cr / ₹XX.XX L (Indian formatting)
19. ✅ Dates display in DD-MMM-YYYY Indian format
20. ✅ Loading skeletons + empty states on every chart

---

## 17. Appendix A — Sample Prisma Schema

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL") // "file:./dev.db"
}

model Rep {
  repId             String   @id @map("rep_id")
  firstName         String   @map("first_name")
  lastName          String   @map("last_name")
  email             String   @unique
  phone             String
  role              String
  managerId         String?  @map("manager_id")
  manager           Rep?     @relation("RepHierarchy", fields: [managerId], references: [repId])
  reports           Rep[]    @relation("RepHierarchy")
  zone              String
  state             String
  city              String
  hireDate          DateTime @map("hire_date")
  exitDate          DateTime? @map("exit_date")
  status            String
  baseSalaryInr     Int      @map("base_salary_inr")
  targetStretchPct  Float    @map("target_stretch_pct")
  visits            Visit[]
  sales             Sale[]
  expenses          Expense[]
  targets           Target[]

  @@map("reps")
}

model Hcp {
  hcpId            String   @id @map("hcp_id")
  firstName        String   @map("first_name")
  lastName         String   @map("last_name")
  specialty        String
  tier             String
  decile           Int
  city             String
  state            String
  zone             String
  hospital         String?
  yearsPracticing  Int      @map("years_practicing")
  preferredContact String   @map("preferred_contact")
  npiLikeId        String   @unique @map("npi_like_id")
  visits           Visit[]
  sales            Sale[]

  @@map("hcps")
}

model Product {
  productId     String   @id @map("product_id")
  productName   String   @map("product_name")
  molecule      String
  therapyArea   String   @map("therapy_area")
  launchDate    DateTime @map("launch_date")
  mrpInr        Int      @map("mrp_inr")
  packSize      Int      @map("pack_size")
  isNewLaunch   Boolean  @map("is_new_launch")
  priority      String
  sales         Sale[]
  targets       Target[]

  @@map("products")
}

model Visit {
  visitId           String   @id @map("visit_id")
  repId             String   @map("rep_id")
  rep               Rep      @relation(fields: [repId], references: [repId])
  hcpId             String   @map("hcp_id")
  hcp               Hcp      @relation(fields: [hcpId], references: [hcpId])
  visitDate         DateTime @map("visit_date")
  visitType         String   @map("visit_type")
  durationMin       Int      @map("duration_min")
  productsDetailed  String   @map("products_detailed")
  samplesDropped    Int      @map("samples_dropped")
  outcome           String
  followupRequired  Boolean  @map("followup_required")

  @@map("visits")
}

model Sale {
  invoiceId     String   @id @map("invoice_id")
  distributorId String   @map("distributor_id")
  repId         String   @map("rep_id")
  rep           Rep      @relation(fields: [repId], references: [repId])
  hcpId         String   @map("hcp_id")
  hcp           Hcp      @relation(fields: [hcpId], references: [hcpId])
  productId     String   @map("product_id")
  product       Product  @relation(fields: [productId], references: [productId])
  qtyPacks      Int      @map("qty_packs")
  unitPriceInr  Int      @map("unit_price_inr")
  discountPct   Float    @map("discount_pct")
  netValueInr   Int      @map("net_value_inr")
  invoiceDate   DateTime @map("invoice_date")
  channel       String

  @@map("sales")
}

model Expense {
  expenseId        String   @id @map("expense_id")
  repId            String   @map("rep_id")
  rep              Rep      @relation(fields: [repId], references: [repId])
  expenseDate      DateTime @map("expense_date")
  category         String
  amountInr        Int      @map("amount_inr")
  reimbursed       Boolean
  policyCompliant  Boolean  @map("policy_compliant")
  notes            String?

  @@map("expenses")
}

model Target {
  targetId         String  @id @map("target_id")
  repId            String  @map("rep_id")
  rep              Rep     @relation(fields: [repId], references: [repId])
  productId        String  @map("product_id")
  product          Product @relation(fields: [productId], references: [productId])
  fy               Int
  quarter          String
  targetQty        Int     @map("target_qty")
  targetValueInr   Int     @map("target_value_inr")

  @@map("targets")
}
```

---

## 18. Appendix B — Sample Data Generation Script (Python)

```python
# scripts/generate_dataset.py
"""
Generates the 7-table fab dataset for MedLife Pharma.
Output: /data/{reps,hcps,products,visits,sales,expenses,targets}.csv
Run: python scripts/generate_dataset.py
"""
import os
import random
from datetime import date, timedelta
import numpy as np
import pandas as pd
from faker import Faker

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
os.makedirs(OUT_DIR, exist_ok=True)

# Reproducibility
SEED = 42
random.seed(SEED)
np.random.seed(SEED)
fake = Faker("en_IN")
Faker.seed(SEED)

CITIES = {
    "Mumbai": ("Maharashtra", "West"),
    "Delhi": ("Delhi", "North"),
    "Bengaluru": ("Karnataka", "South"),
    "Chennai": ("Tamil Nadu", "South"),
    "Kolkata": ("West Bengal", "East"),
    "Hyderabad": ("Telangana", "South"),
    "Pune": ("Maharashtra", "West"),
    "Ahmedabad": ("Gujarat", "West"),
    "Jaipur": ("Rajasthan", "North"),
    "Lucknow": ("Uttar Pradesh", "North"),
    "Kochi": ("Kerala", "South"),
    "Bhopal": ("Madhya Pradesh", "West"),
}

START_DATE = date(2023, 4, 1)
END_DATE = date(2026, 3, 31)

def daterange(start, end):
    d = start
    while d <= end:
        yield d
        d += timedelta(days=1)

def is_working_day(d):
    return d.weekday() < 6  # Mon-Sat

# --- 1. REPS ---
def gen_reps():
    # 1 National Head, 4 RMs, 8 AMs, ~37 Field Reps
    reps = []
    # ... full logic: hierarchy, hire_date, attrition, exit_date, replacements
    return pd.DataFrame(reps)

# --- 2. HCPS ---
def gen_hcps():
    hcps = []
    # ... 3000 HCPs, tier distribution A=20/B=50/C=30, city weighted by population
    return pd.DataFrame(hcps)

# --- 3. PRODUCTS ---
PRODUCTS = [
    # Cardio
    ("PRD-CARD-01", "Cardiolex", "Atorvastatin", "Cardio", date(2018,4,1), 350, 10, False, "Maintain"),
    ("PRD-CARD-03", "Vasoclear", "Rosuvastatin", "Cardio", date(2024,9,15), 680, 10, True, "Strategic"),
    # Diabetes
    ("PRD-DIAB-02", "Glucoflex", "Metformin", "Diabetes", date(2018,6,1), 120, 15, False, "Maintain"),
    # ... 9 more products across 4 therapy areas
]

# --- 4. VISITS ---
def gen_visits(reps_df, hcps_df):
    visits = []
    for d in daterange(START_DATE, END_DATE):
        if not is_working_day(d):
            continue
        active_reps = reps_df[(reps_df.status == "Active")].rep_id.tolist()
        for rep_id in active_reps:
            n_visits = random.randint(8, 12)
            for _ in range(n_visits):
                # Bias HCP selection by tier
                # ... visit generation logic
                pass
    return pd.DataFrame(visits)

# --- 5. SALES ---
def gen_sales(reps_df, hcps_df, products_df):
    # 2 invoices/month for Tier A, 1 for B, 0.3 for C
    # Apply seasonality: March & Sep = 1.3x, May = 0.85x
    # Apply 8% YoY growth
    # New products: 6-month linear ramp
    pass

# --- 6. EXPENSES ---
def gen_expenses(reps_df):
    # 5-8 entries per rep per week
    pass

# --- 7. TARGETS ---
def gen_targets(reps_df, products_df, sales_df):
    # target = last_year_actual × 1.15 × rep.target_stretch_pct
    pass

if __name__ == "__main__":
    print("Generating reps..."); reps = gen_reps()
    print("Generating hcps..."); hcps = gen_hcps()
    print("Generating products..."); products = pd.DataFrame(PRODUCTS, columns=[...])
    print("Generating visits..."); visits = gen_visits(reps, hcps)
    print("Generating sales..."); sales = gen_sales(reps, hcps, products)
    print("Generating expenses..."); expenses = gen_expenses(reps)
    print("Generating targets..."); targets = gen_targets(reps, products, sales)

    for name, df in [("reps",reps),("hcps",hcps),("products",products),
                     ("visits",visits),("sales",sales),("expenses",expenses),
                     ("targets",targets)]:
        df.to_csv(f"{OUT_DIR}/{name}.csv", index=False)
        print(f"  {name}: {len(df)} rows")
```

(Fill in the body of each `gen_*` function per the rules in Section 6. The skeleton above shows the structure and the reproducibility pattern.)

---

## 19. Appendix C — Sample Chart Component (Rep Leaderboard)

```tsx
// components/charts/rep-leaderboard.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";

export type RepAttainment = {
  repId: string;
  repName: string;
  zone: string;
  attainmentPct: number;
  revenueInr: number;
};

const colorForAttainment = (pct: number) =>
  pct >= 100 ? "#16A34A" : pct >= 80 ? "#F59E0B" : "#DC2626";

export function RepLeaderboard({
  data,
  title = "Rep Leaderboard — Attainment %",
  limit = 10,
}: {
  data: RepAttainment[];
  title?: string;
  limit?: number;
}) {
  const top = [...data]
    .sort((a, b) => b.attainmentPct - a.attainmentPct)
    .slice(0, limit);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={limit * 28 + 20}>
          <BarChart data={top} layout="vertical" margin={{ left: 80, right: 16 }}>
            <XAxis type="number" domain={[0, "auto"]} tickFormatter={(v) => `${v}%`} />
            <YAxis
              type="category"
              dataKey="repName"
              width={80}
              tick={{ fontSize: 11 }}
            />
            <Tooltip
              formatter={(v: number) => [`${v.toFixed(1)}%`, "Attainment"]}
              labelFormatter={(_, p) => {
                const row = p?.[0]?.payload as RepAttainment;
                return row ? `${row.repName} · ${row.zone}` : "";
              }}
            />
            <ReferenceLine x={100} stroke="#64748B" strokeDasharray="3 3" />
            <Bar dataKey="attainmentPct" radius={[0, 4, 4, 0]}>
              {top.map((row) => (
                <Cell key={row.repId} fill={colorForAttainment(row.attainmentPct)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

---

## 20. Appendix D — India State → Zone Mapping

Use this mapping for the geo map and zone filters. All 28 states + 8 UTs covered.

| Zone | States / UTs |
|---|---|
| **North** | Jammu & Kashmir, Ladakh, Himachal Pradesh, Punjab, Haryana, Delhi, Uttarakhand, Uttar Pradesh, Rajasthan, Chandigarh |
| **South** | Andhra Pradesh, Telangana, Karnataka, Tamil Nadu, Kerala, Puducherry, Lakshadweep, Andaman & Nicobar Islands |
| **East** | Bihar, Jharkhand, West Bengal, Odisha, Sikkim, Assam, Meghalaya, Manipur, Mizoram, Nagaland, Tripura, Arunachal Pradesh |
| **West** | Gujarat, Maharashtra, Goa, Madhya Pradesh, Chhattisgarh, Dadra & Nagar Haveli and Daman & Diu |

---

## 21. Open Questions & Final Notes to the Agent

### 21.1 Assumptions You Are Allowed to Make

- Currency is INR. Display in **₹X.XX Cr** for amounts ≥ ₹1 Cr, **₹X.XX L** for amounts ≥ ₹1 L, else **₹X,XXX**. Use Indian digit grouping (1,00,000 not 100,000).
- Fiscal year is **April → March**. Quarters are: Q1 = Apr-Jun, Q2 = Jul-Sep, Q3 = Oct-Dec, Q4 = Jan-Mar.
- The dashboard does not need authentication — assume a single logged-in user with full visibility.
- No PII masking is required (the data is fabricated).
- The "India geo map" should use a TopoJSON file for Indian states. Source it from `india-states.topo.json` in `/public`. A reasonable public source is the [react-simple-maps India example repo](https://github.com/zcreativelabs/react-simple-maps) — verify the license before committing.

### 21.2 Open Questions (pick a sensible default + document in README)

1. **Mobile behavior for the calendar heatmap** — collapse to a 6-month view? Pick a sensible default.
2. **Forecast model** — statsmodels Holt-Winters is the default. If you find a simpler moving-average gives lower MAPE on backtest, you may switch and document why.
3. **Date range picker default** — last 12 months is the suggested default. Confirm or pick a different sensible default.
4. **Prisma DB engine** — SQLite is fine for local dev. If you choose to add Postgres support, document the env var swap.
5. **Color palette** — the suggested palette is sky blue (#0EA5E9) for primary, slate (#0F172A) for text, with semantic green/amber/red. You may swap to a different 3-color palette if it improves contrast.

### 21.3 Final Notes

- Treat reproducibility as a hard requirement. The same `python scripts/generate_dataset.py` run with seed 42 must produce byte-identical CSVs every time. If you find non-determinism (e.g., dict ordering, set iteration), pin it.
- The dataset is the foundation. Spend time getting it right — every chart depends on it. A typical mistake is to generate `visits` and `sales` independently and lose the causal link (a visit should precede the sale within 14 days). The `gen_sales` function must read from the `visits` table, not generate from scratch.
- The dashboard is a demo, not a production system. Optimize for clarity and visual polish over engineering rigor. If a 200-line Prisma query and a 50-line Prisma query produce the same chart, prefer the 50-line one.
- When in doubt, ship the simplest version that meets the acceptance criteria. You can always iterate.

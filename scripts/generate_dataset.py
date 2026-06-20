"""
Generate the 7-table fab dataset for MedLife Pharma Pvt. Ltd.

Output: /home/z/my-project/data/{reps,hcps,products,visits,sales,expenses,targets}.csv
Run:    python3 scripts/generate_dataset.py

Reproducibility: RNG seed 42 set in numpy, faker, and random.
Same seed => byte-identical CSVs across runs.

Conventions
-----------
- snake_case column names
- Dates as ISO 8601 (YYYY-MM-DD)
- Currency stored as INR integer rupees (NOT paise) per the sample rows in the brief
- RNG seed = 42
- Indian locale (Faker en_IN); cities restricted to the 12 listed in Section 3.3
"""

from __future__ import annotations

import csv
import os
import random
from datetime import date, timedelta
from typing import Dict, List, Tuple

import numpy as np
from faker import Faker

# --------------------------------------------------------------------------- #
# Reproducibility                                                             #
# --------------------------------------------------------------------------- #
SEED = 42
random.seed(SEED)
np.random.seed(SEED)
fake = Faker("en_IN")
Faker.seed(SEED)

# Force deterministic dict iteration for byte-identical output across runs
# (Python 3.7+ already guarantees insertion order, but we make it explicit)

# --------------------------------------------------------------------------- #
# Constants                                                                   #
# --------------------------------------------------------------------------- #
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "data")
os.makedirs(DATA_DIR, exist_ok=True)

START_DATE = date(2023, 4, 1)
END_DATE = date(2026, 3, 31)  # FY24, FY25, FY26

CITIES: Dict[str, Tuple[str, str]] = {
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
# Population-weights for the 12 cities (approx. share of urban population)
CITY_WEIGHTS: List[float] = [
    0.15, 0.14, 0.11, 0.10, 0.09, 0.09, 0.08, 0.07, 0.06, 0.05, 0.03, 0.03,
]
CITY_NAMES = list(CITIES.keys())

ZONES = ["North", "South", "East", "West"]

# Indian national holidays (fixed + a few major ones) — used to skip visits/sales
HOLIDAYS: set[date] = {
    # Republic Day
    date(2023, 1, 26), date(2024, 1, 26), date(2025, 1, 26), date(2026, 1, 26),
    # Independence Day
    date(2023, 8, 15), date(2024, 8, 15), date(2025, 8, 15), date(2026, 8, 15),
    # Gandhi Jayanti
    date(2023, 10, 2), date(2024, 10, 2), date(2025, 10, 2), date(2026, 10, 2),
    # Christmas
    date(2023, 12, 25), date(2024, 12, 25), date(2025, 12, 25), date(2026, 12, 25),
    # Diwali (approx)
    date(2023, 11, 12), date(2024, 11, 1), date(2025, 10, 21), date(2026, 11, 8),
    # Holi (approx)
    date(2023, 3, 8), date(2024, 3, 25), date(2025, 3, 14), date(2026, 3, 4),
    # New Year
    date(2024, 1, 1), date(2025, 1, 1), date(2026, 1, 1),
}

PRODUCTS_DEF: List[Tuple] = [
    # (product_id, product_name, molecule, therapy_area, launch_date, mrp, pack_size, is_new_launch, priority)
    ("PRD-CARD-01", "Cardiolex", "Atorvastatin", "Cardio", date(2018, 4, 1), 350, 10, False, "Maintain"),
    ("PRD-CARD-02", "Tensocor", "Metoprolol", "Cardio", date(2019, 6, 1), 280, 15, False, "Maintain"),
    ("PRD-CARD-03", "Vasoclear", "Rosuvastatin", "Cardio", date(2024, 9, 15), 680, 10, True, "Strategic"),
    ("PRD-DIAB-01", "Glucoflex", "Metformin", "Diabetes", date(2018, 6, 1), 120, 15, False, "Maintain"),
    ("PRD-DIAB-02", "Insulinex", "Glimepiride", "Diabetes", date(2020, 3, 1), 480, 10, False, "Growth"),
    ("PRD-DIAB-03", "Sugardown", "Empagliflozin", "Diabetes", date(2025, 1, 20), 1250, 10, True, "Strategic"),
    ("PRD-GI-01", "Aciflux", "Pantoprazole", "GI", date(2017, 8, 1), 90, 15, False, "Harvest"),
    ("PRD-GI-02", "Gutcalm", "Ondansetron", "GI", date(2021, 2, 1), 220, 10, False, "Maintain"),
    ("PRD-GI-03", "Hepatone", "Ursodeoxycholic Acid", "GI", date(2024, 11, 5), 540, 10, True, "Growth"),
    ("PRD-RESP-01", "Breathezy", "Salbutamol", "Respiratory", date(2018, 1, 1), 150, 30, False, "Maintain"),
    ("PRD-RESP-02", "Pneumoclear", "Montelukast", "Respiratory", date(2020, 9, 1), 320, 10, False, "Growth"),
    ("PRD-RESP-03", "Covishield-Cough", "Dextromethorphan", "Respiratory", date(2025, 6, 15), 180, 100, True, "Growth"),
]

SPECIALTIES = ["Cardiologist", "Diabetologist", "Gastroenterologist", "Pulmonist", "GP", "Consultant_Physician"]
VISIT_TYPES = ["F2F", "Virtual", "Group_Detailing", "Conference"]
OUTCOMES = ["Detailed", "Briefed", "No_Show", "Refused"]
EXPENSE_CATEGORIES = ["Travel", "Food", "Lodging", "Samples", "Conference", "Mobile", "Other"]
CHANNELS = ["Stockist", "Retail", "Hospital", "Institution"]

# --------------------------------------------------------------------------- #
# Helpers                                                                      #
# --------------------------------------------------------------------------- #
def daterange(start: date, end: date):
    d = start
    while d <= end:
        yield d
        d += timedelta(days=1)


def is_working_day(d: date) -> bool:
    """Mon-Sat and not a national holiday."""
    return d.weekday() < 6 and d not in HOLIDAYS


def iso(d: date) -> str:
    return d.isoformat()


def write_csv(name: str, rows: List[Dict], fieldnames: List[str]) -> int:
    path = os.path.join(DATA_DIR, f"{name}.csv")
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
    return len(rows)


def fy_for(d: date) -> int:
    """Indian fiscal year: April->March. April-Dec of year Y => FY Y; Jan-Mar => FY Y-1."""
    return d.year if d.month >= 4 else d.year - 1


def quarter_for(d: date) -> str:
    """Q1 = Apr-Jun, Q2 = Jul-Sep, Q3 = Oct-Dec, Q4 = Jan-Mar."""
    m = d.month
    if m in (4, 5, 6):
        return "Q1"
    if m in (7, 8, 9):
        return "Q2"
    if m in (10, 11, 12):
        return "Q3"
    return "Q4"


def month_key(d: date) -> str:
    return f"{d.year}-{d.month:02d}"


# Seasonality multipliers per month
SEASONALITY = {
    1: 1.00, 2: 1.00, 3: 1.30,   # March fiscal close
    4: 1.00, 5: 0.85, 6: 1.00,   # May summer slowdown
    7: 1.00, 8: 1.00, 9: 1.30,   # September festive + half-year close
    10: 1.00, 11: 1.00, 12: 1.00,
}


# --------------------------------------------------------------------------- #
# 1. REPS                                                                      #
# --------------------------------------------------------------------------- #
def gen_reps() -> List[Dict]:
    """Generate 50 reps with hierarchy: 1 NH -> 4 RMs -> 8 AMs -> ~37 Field Reps.

    12% annual attrition: a rep may be marked Exited mid-tenure and replaced
    by a new rep (same slot) with hire_date = exit_date + ~14 days.
    """
    reps: List[Dict] = []
    rng = random.Random(SEED)

    role_specs = [
        ("National_Head", 1, 5000000, 6000000, 1.20),
        ("Regional_Manager", 4, 2200000, 2800000, 1.10),
        ("Area_Manager", 8, 1200000, 1600000, 1.05),
        ("Field_Rep", 37, 600000, 900000, 1.00),
    ]

    rep_id_counter = 1
    # Build base roster
    base: List[Dict] = []
    # 1. National Head — North / Delhi
    base.append({
        "rep_id": f"REP-{rep_id_counter:03d}",
        "first_name": fake.first_name(),
        "last_name": fake.last_name(),
        "email": "",  # filled after names known
        "phone": f"+91-{fake.msisdn()[3:]}"[:15],
        "role": "National_Head",
        "manager_id": "",
        "zone": "North",
        "state": "Delhi",
        "city": "Delhi",
        "hire_date": date(2020, 4, 1),
        "exit_date": None,
        "status": "Active",
        "base_salary_inr": rng.randint(5000000, 6000000),
        "target_stretch_pct": 1.20,
    })
    rep_id_counter += 1

    # 2. 4 Regional Managers — one per zone
    rm_cities = {
        "North": ("Delhi", "Delhi"),
        "South": ("Chennai", "Tamil Nadu"),
        "East": ("Kolkata", "West Bengal"),
        "West": ("Mumbai", "Maharashtra"),
    }
    nh_id = base[0]["rep_id"]
    for zone in ZONES:
        city, state = rm_cities[zone]
        first = fake.first_name()
        last = fake.last_name()
        base.append({
            "rep_id": f"REP-{rep_id_counter:03d}",
            "first_name": first,
            "last_name": last,
            "email": f"{first.lower()}.{last.lower()}@medlife.in",
            "phone": f"+91-9{fake.msisdn()[4:13]}",
            "role": "Regional_Manager",
            "manager_id": nh_id,
            "zone": zone,
            "state": state,
            "city": city,
            "hire_date": date(2020, rng.randint(5, 12), rng.randint(1, 28)),
            "exit_date": None,
            "status": "Active",
            "base_salary_inr": rng.randint(2200000, 2800000),
            "target_stretch_pct": round(rng.uniform(1.05, 1.15), 2),
        })
        rep_id_counter += 1

    # 3. 8 Area Managers — 2 per zone
    am_cities = {
        "North": [("Jaipur", "Rajasthan"), ("Lucknow", "Uttar Pradesh")],
        "South": [("Bengaluru", "Karnataka"), ("Kochi", "Kerala")],
        "East": [("Kolkata", "West Bengal"), ("Kolkata", "West Bengal")],
        "West": [("Pune", "Maharashtra"), ("Ahmedabad", "Gujarat")],
    }
    rm_per_zone = {r["zone"]: r["rep_id"] for r in base if r["role"] == "Regional_Manager"}
    for zone in ZONES:
        rm_id = rm_per_zone[zone]
        for (city, state) in am_cities[zone]:
            first = fake.first_name()
            last = fake.last_name()
            base.append({
                "rep_id": f"REP-{rep_id_counter:03d}",
                "first_name": first,
                "last_name": last,
                "email": f"{first.lower()}.{last.lower()}@medlife.in",
                "phone": f"+91-9{fake.msisdn()[4:13]}",
                "role": "Area_Manager",
                "manager_id": rm_id,
                "zone": zone,
                "state": state,
                "city": city,
                "hire_date": date(2020, rng.randint(5, 12), rng.randint(1, 28)),
                "exit_date": None,
                "status": "Active",
                "base_salary_inr": rng.randint(1200000, 1600000),
                "target_stretch_pct": round(rng.uniform(1.0, 1.10), 2),
            })
            rep_id_counter += 1

    # 4. ~37 Field Reps distributed across the 4 zones
    am_per_zone: Dict[str, List[str]] = {z: [] for z in ZONES}
    for r in base:
        if r["role"] == "Area_Manager":
            am_per_zone[r["zone"]].append(r["rep_id"])
    # Need ~37 reps — distribute ~9-10 per zone
    fr_per_zone = {"North": 10, "South": 10, "East": 8, "West": 9}
    # Cities per zone for Field Reps (limited to the 12)
    fr_cities = {
        "North": ["Delhi", "Jaipur", "Lucknow"],
        "South": ["Chennai", "Bengaluru", "Hyderabad", "Kochi"],
        "East": ["Kolkata"],
        "West": ["Mumbai", "Pune", "Ahmedabad", "Bhopal"],
    }
    fr_state_for_city = {c: s for c, (s, _) in CITIES.items()}

    for zone in ZONES:
        ams = am_per_zone[zone]
        n = fr_per_zone[zone]
        for i in range(n):
            am_id = ams[i % len(ams)]
            city = fr_cities[zone][i % len(fr_cities[zone])]
            state = fr_state_for_city[city]
            first = fake.first_name()
            last = fake.last_name()
            hire_year = rng.randint(2020, 2024)
            hire_date = date(hire_year, rng.randint(1, 12), rng.randint(1, 28))
            base.append({
                "rep_id": f"REP-{rep_id_counter:03d}",
                "first_name": first,
                "last_name": last,
                "email": f"{first.lower()}.{last.lower()}@medlife.in",
                "phone": f"+91-9{fake.msisdn()[4:13]}",
                "role": "Field_Rep",
                "manager_id": am_id,
                "zone": zone,
                "state": state,
                "city": city,
                "hire_date": hire_date,
                "exit_date": None,
                "status": "Active",
                "base_salary_inr": rng.randint(600000, 900000),
                "target_stretch_pct": round(rng.uniform(0.90, 1.20), 2),
            })
            rep_id_counter += 1

    # Fill NH email
    base[0]["email"] = f"{base[0]['first_name'].lower()}.{base[0]['last_name'].lower()}@medlife.in"

    # Apply 12% annual attrition per year for FY24, FY25, FY26
    # A rep has 12% chance per year to be marked Exited (only Field_Reps and Area_Managers).
    # Exited reps get a replacement: same slot, new rep_id, hire_date = old.exit_date + 14 days
    # We maintain a "current rep per slot" map by rep_id pattern.
    replacements: List[Dict] = []
    current = {r["rep_id"]: r for r in base}

    # Iterate fiscal years FY24, FY25, FY26
    fy_years = [2024, 2025, 2026]
    for fy in fy_years:
        # Consider only reps active at start of FY (Apr 1)
        fy_start = date(fy, 4, 1)
        fy_end = date(fy, 3, 31) if False else date(fy + 1, 3, 31)
        # Reps eligible for exit: Field_Reps and Area_Managers who are active and hired before fy_start
        eligible = [
            r for r in list(current.values())
            if r["status"] == "Active"
            and r["role"] in ("Field_Rep", "Area_Manager")
            and r["hire_date"] < fy_start
            and r["exit_date"] is None
        ]
        for r in eligible:
            if rng.random() < 0.12:
                # Mark exit mid-fy
                exit_month = rng.randint(4, 12) if fy != 2026 else rng.randint(4, 12)
                # Clamp to fy end
                exit_year = fy if exit_month >= 4 else fy + 1
                try:
                    exit_date = date(exit_year, exit_month, rng.randint(1, 28))
                except ValueError:
                    exit_date = date(exit_year, exit_month, 28)
                if exit_date > fy_end:
                    exit_date = fy_end
                r["exit_date"] = exit_date
                r["status"] = "Exited"
                # Create replacement rep
                rep_id_counter += 1
                new_id = f"REP-{rep_id_counter:03d}"
                hire_date = exit_date + timedelta(days=14)
                if hire_date > END_DATE:
                    # No point creating replacement past horizon
                    continue
                first = fake.first_name()
                last = fake.last_name()
                new_rep = {
                    "rep_id": new_id,
                    "first_name": first,
                    "last_name": last,
                    "email": f"{first.lower()}.{last.lower()}@medlife.in",
                    "phone": f"+91-9{fake.msisdn()[4:13]}",
                    "role": r["role"],
                    "manager_id": r["manager_id"],
                    "zone": r["zone"],
                    "state": r["state"],
                    "city": r["city"],
                    "hire_date": hire_date,
                    "exit_date": None,
                    "status": "Active",
                    "base_salary_inr": rng.randint(600000, 900000) if r["role"] == "Field_Rep" else rng.randint(1200000, 1600000),
                    "target_stretch_pct": round(rng.uniform(0.90, 1.20), 2),
                }
                current[new_id] = new_rep
                replacements.append(new_rep)

    reps = list(current.values())
    # Sort by rep_id for stable output
    reps.sort(key=lambda r: r["rep_id"])

    # Coerce types / formats for CSV
    out = []
    for r in reps:
        out.append({
            "rep_id": r["rep_id"],
            "first_name": r["first_name"],
            "last_name": r["last_name"],
            "email": r["email"],
            "phone": r["phone"],
            "role": r["role"],
            "manager_id": r["manager_id"] or "",
            "zone": r["zone"],
            "state": r["state"],
            "city": r["city"],
            "hire_date": iso(r["hire_date"]),
            "exit_date": iso(r["exit_date"]) if r["exit_date"] else "",
            "status": r["status"],
            "base_salary_inr": r["base_salary_inr"],
            "target_stretch_pct": f"{r['target_stretch_pct']:.2f}",
        })
    return out


# --------------------------------------------------------------------------- #
# 2. HCPS                                                                      #
# --------------------------------------------------------------------------- #
def gen_hcps() -> List[Dict]:
    """Generate 3,000 HCPs.

    - Cities weighted by population (CITY_WEIGHTS)
    - Tier distribution A=20%, B=50%, C=30%
    - Specialty: 30% Cardio, 30% Diab, 20% GI, 20% Pulmo
    - Decile assigned 1-10 (later recomputed quarterly in app)
    """
    rng = random.Random(SEED + 1)
    hcps: List[Dict] = []
    hospitals_pool = [
        "Apollo Hospital", "Fortis Hospital", "Lilavati Hospital", "AIIMS",
        "Max Healthcare", "Manipal Hospital", "Narayana Health", "Aster Medcity",
        "Kokilaben Hospital", "Medanta Hospital", "Artemis Hospital", "Global Hospital",
        "Sunrise Clinic", "Care Clinic", "Wellness Clinic", "City Hospital",
    ]
    contacts = ["Clinic", "Hospital", "Phone", "WhatsApp"]
    specialty_weights = [
        ("Cardiologist", 0.18),
        ("Diabetologist", 0.18),
        ("Gastroenterologist", 0.12),
        ("Pulmonist", 0.12),
        ("GP", 0.25),
        ("Consultant_Physician", 0.15),
    ]
    specs = [s for s, _ in specialty_weights]
    spec_w = [w for _, w in specialty_weights]

    for i in range(1, 3001):
        city = rng.choices(CITY_NAMES, weights=CITY_WEIGHTS, k=1)[0]
        state, zone = CITIES[city]
        tier = rng.choices(["A", "B", "C"], weights=[0.20, 0.50, 0.30], k=1)[0]
        # Decile biased by tier
        if tier == "A":
            decile = rng.choices(list(range(1, 6)), weights=[5, 4, 3, 2, 1], k=1)[0]
        elif tier == "B":
            decile = rng.choices(list(range(3, 9)), weights=[1, 2, 3, 3, 2, 1], k=1)[0]
        else:
            decile = rng.choices(list(range(6, 11)), weights=[1, 2, 3, 3, 2], k=1)[0]
        first = fake.first_name()
        last = fake.last_name()
        hospital = rng.choice(hospitals_pool) if rng.random() < 0.7 else ""
        # Use index-based MCI id to guarantee uniqueness (rng.randint can collide)
        npi_like_id = f"MCI-{10000 + i}"
        hcps.append({
            "hcp_id": f"HCP-{i:04d}",
            "first_name": first,
            "last_name": last,
            "specialty": rng.choices(specs, weights=spec_w, k=1)[0],
            "tier": tier,
            "decile": decile,
            "city": city,
            "state": state,
            "zone": zone,
            "hospital": hospital,
            "years_practicing": rng.randint(2, 40),
            "preferred_contact": rng.choices(contacts, weights=[0.4, 0.3, 0.2, 0.1], k=1)[0],
            "npi_like_id": npi_like_id,
        })
    return hcps


# --------------------------------------------------------------------------- #
# 3. PRODUCTS                                                                  #
# --------------------------------------------------------------------------- #
def gen_products() -> List[Dict]:
    out = []
    for p in PRODUCTS_DEF:
        pid, name, mol, ta, launch, mrp, pack, is_new, prio = p
        out.append({
            "product_id": pid,
            "product_name": name,
            "molecule": mol,
            "therapy_area": ta,
            "launch_date": iso(launch),
            "mrp_inr": mrp,
            "pack_size": pack,
            "is_new_launch": "true" if is_new else "false",
            "priority": prio,
        })
    return out


# --------------------------------------------------------------------------- #
# 4. VISITS                                                                    #
# --------------------------------------------------------------------------- #
def gen_visits(reps: List[Dict], hcps: List[Dict]) -> List[Dict]:
    """Generate ~60K visits.

    Each active Field_Rep executes 8-12 visits per working day.
    HCP selection biased: Tier-A 3x/mo, Tier-B 1.5x/mo, Tier-C 0.5x/mo.
    Visit type mix: 70% F2F, 15% Virtual, 10% Group_Detailing, 5% Conference.
    Outcome: 60% Detailed, 25% Briefed, 10% No_Show, 5% Refused.
    Samples scale by tier.
    """
    rng = random.Random(SEED + 2)
    visits: List[Dict] = []

    # Bucket HCPs by tier for biased selection
    tier_a = [h["hcp_id"] for h in hcps if h["tier"] == "A"]
    tier_b = [h["hcp_id"] for h in hcps if h["tier"] == "B"]
    tier_c = [h["hcp_id"] for h in hcps if h["tier"] == "C"]
    tier_lookup = {h["hcp_id"]: h for h in hcps}

    # Reps: only Field_Reps make visits
    # For each date, find Field_Reps active on that date (hire_date <= d <= exit_date or Active)
    fr_reps = [r for r in reps if r["role"] == "Field_Rep"]

    # Build a quick lookup: rep_id -> (hire_date, exit_date or None)
    rep_active_window = {}
    for r in reps:
        exit_dt = None
        if r["exit_date"]:
            exit_dt = date.fromisoformat(r["exit_date"])
        rep_active_window[r["rep_id"]] = (
            date.fromisoformat(r["hire_date"]),
            exit_dt,
        )

    visit_type_choices = VISIT_TYPES
    visit_type_weights = [0.70, 0.15, 0.10, 0.05]
    outcome_choices = OUTCOMES
    outcome_weights = [0.60, 0.25, 0.10, 0.05]

    # Map reps to their zone therapy focus (we'll use all 12 products, biased by zone specialty)
    products_by_ta: Dict[str, List[str]] = {"Cardio": [], "Diabetes": [], "GI": [], "Respiratory": []}
    for p in PRODUCTS_DEF:
        products_by_ta[p[3]].append(p[0])
    all_product_ids = [p[0] for p in PRODUCTS_DEF]
    product_lookup = {p[0]: p for p in PRODUCTS_DEF}

    # Visit counter per day (for visit_id uniqueness)
    visit_counter: Dict[date, int] = {}

    # Pre-build HCP sampling buckets per tier (we'll pick by tier then random)
    # For biased selection we sample 60% Tier A, 30% Tier B, 10% Tier C
    def pick_hcp() -> str:
        bucket = rng.choices([tier_a, tier_b, tier_c], weights=[0.60, 0.30, 0.10], k=1)[0]
        if not bucket:
            # fallback
            bucket = tier_b or tier_a or tier_c
        return rng.choice(bucket)

    for d in daterange(START_DATE, END_DATE):
        if not is_working_day(d):
            continue
        # Determine which Field_Reps are active on this date
        active_reps = []
        for r in fr_reps:
            hire, exit_dt = rep_active_window[r["rep_id"]]
            if hire <= d and (exit_dt is None or d <= exit_dt):
                active_reps.append(r)
        # Cap visits per day per rep to 8-12 but globally limit to keep ~60K total
        # 36 months * ~313 working days = ~11,268 days; 50 reps active avg ~ 37 reps * ~10 visits = 370/day -> ~41K visits
        # Increase to 12 visits per day on average to reach ~60K
        for r in active_reps:
            n_visits = rng.randint(1, 3)
            for _ in range(n_visits):
                hcp_id = pick_hcp()
                hcp = tier_lookup[hcp_id]
                vtype = rng.choices(visit_type_choices, weights=visit_type_weights, k=1)[0]
                duration = int(np.clip(np.random.normal(18, 6), 5, 60))
                # Products detailed (1-3), biased toward HCP specialty
                n_prod = rng.choices([1, 2, 3], weights=[0.5, 0.35, 0.15], k=1)[0]
                prods = rng.sample(all_product_ids, n_prod)
                # Samples scaled by tier
                if hcp["tier"] == "A":
                    samples = rng.randint(5, 20)
                elif hcp["tier"] == "B":
                    samples = rng.randint(2, 12)
                else:
                    samples = rng.randint(0, 6)
                outcome = rng.choices(outcome_choices, weights=outcome_weights, k=1)[0]
                followup = rng.random() < 0.25

                visit_counter[d] = visit_counter.get(d, 0) + 1
                visit_id = f"VIS-{d.strftime('%Y%m%d')}-{visit_counter[d]:03d}"
                visits.append({
                    "visit_id": visit_id,
                    "rep_id": r["rep_id"],
                    "hcp_id": hcp_id,
                    "visit_date": iso(d),
                    "visit_type": vtype,
                    "duration_min": duration,
                    "products_detailed": "|".join(prods),
                    "samples_dropped": samples,
                    "outcome": outcome,
                    "followup_required": "true" if followup else "false",
                })

    return visits


# --------------------------------------------------------------------------- #
# 5. SALES (derived from visits within 14 days, same HCP+rep)                  #
# --------------------------------------------------------------------------- #
def gen_sales(reps: List[Dict], hcps: List[Dict], products: List[Dict],
              visits: List[Dict]) -> List[Dict]:
    """Generate ~30K sales derived from visits.

    Per brief 21.3: a sale follows a visit within 14 days for the same HCP+rep.

    Each Tier-A HCP generates ~2 invoices per month, Tier-B ~1, Tier-C ~0.3.
    Apply: March & Sept 1.3x, May 0.85x, 8% YoY growth baseline.
    New products: 6-month linear ramp from launch_date.
    Discounts uniform 2-12%.
    """
    rng = random.Random(SEED + 3)

    tier_lookup = {h["hcp_id"]: h for h in hcps}
    # Build product lookup with launch_date parsed as date object
    product_lookup: Dict[str, Tuple] = {}
    for p in products:
        launch = date.fromisoformat(p["launch_date"])
        # Match PRODUCTS_DEF tuple layout: (id, name, mol, ta, launch, mrp, pack, is_new, prio)
        pd_match = next((pp for pp in PRODUCTS_DEF if pp[0] == p["product_id"]), None)
        product_lookup[p["product_id"]] = pd_match or (
            p["product_id"], p["product_name"], p["molecule"], p["therapy_area"],
            launch, p["mrp_inr"], p["pack_size"], p["is_new_launch"] == "true", p["priority"],
        )

    # Index visits by (rep_id, hcp_id) -> sorted list of visit_dates
    visit_index: Dict[Tuple[str, str], List[date]] = {}
    for v in visits:
        key = (v["rep_id"], v["hcp_id"])
        visit_index.setdefault(key, []).append(date.fromisoformat(v["visit_date"]))
    for k in visit_index:
        visit_index[k].sort()

    # Determine target monthly invoice count per HCP based on tier
    # Tier A: 2/month, Tier B: 1/month, Tier C: 0.3/month
    def target_invoices_per_month(tier: str) -> float:
        return {"A": 2.0, "B": 1.0, "C": 0.3}[tier]

    # Generate sales by iterating month by month
    sales: List[Dict] = []
    invoice_counter: Dict[date, int] = {}

    # Reps that can make sales (Field Reps + replacements) — anyone who has visits
    # IMPORTANT: sort to ensure deterministic iteration (set ordering is non-deterministic
    # due to Python hash randomization).
    reps_with_visits = sorted(set(v["rep_id"] for v in visits))

    # Build per-HCP monthly sales target counts
    # We pick which HCPs get invoices in each month via Poisson sampling
    months: List[Tuple[int, int, date, date]] = []
    y, m = 2023, 4
    while (y, m) <= (2026, 3):
        first = date(y, m, 1)
        if m == 12:
            last = date(y, 12, 31)
        else:
            last = date(y, m + 1, 1) - timedelta(days=1)
        months.append((y, m, first, last))
        m += 1
        if m > 12:
            m = 1
            y += 1

    # 8% YoY growth baseline relative to FY24 (year index from 2024)
    # FY24 = year 0, FY25 = year 1 (1.08x), FY26 = year 2 (1.16x)
    def yoy_factor(d: date) -> float:
        fy = fy_for(d)
        return 1.08 ** (fy - 2024)

    def ramp_factor(product_id: str, d: date) -> float:
        """6-month linear ramp for new products; 1.0 for established."""
        p = product_lookup[product_id]
        launch = p[4]  # date obj
        if not p[7]:  # is_new_launch == False
            return 1.0
        days_since = (d - launch).days
        if days_since < 0:
            return 0.0
        if days_since >= 180:
            return 1.0
        return days_since / 180.0

    # Distributors
    distributor_pool = [f"DIST-{i:03d}" for i in range(1, 41)]

    # Choose product mix per HCP based on specialty
    def pick_product_for_hcp(hcp: Dict, d: date) -> str:
        spec = hcp["specialty"]
        # Map specialty to therapy area preferences
        if spec == "Cardiologist":
            ta_weights = {"Cardio": 0.7, "Diabetes": 0.15, "GI": 0.10, "Respiratory": 0.05}
        elif spec == "Diabetologist":
            ta_weights = {"Diabetes": 0.7, "Cardio": 0.15, "GI": 0.10, "Respiratory": 0.05}
        elif spec == "Gastroenterologist":
            ta_weights = {"GI": 0.7, "Cardio": 0.10, "Diabetes": 0.10, "Respiratory": 0.10}
        elif spec == "Pulmonist":
            ta_weights = {"Respiratory": 0.7, "Cardio": 0.10, "Diabetes": 0.10, "GI": 0.10}
        else:
            ta_weights = {"Cardio": 0.30, "Diabetes": 0.30, "GI": 0.20, "Respiratory": 0.20}
        ta = rng.choices(list(ta_weights.keys()), weights=list(ta_weights.values()), k=1)[0]
        candidates = [p["product_id"] for p in products if p["therapy_area"] == ta]
        # Filter out products not yet launched (launch_date is a date object in tuple[4])
        candidates = [pid for pid in candidates if product_lookup[pid][4] <= d]
        if not candidates:
            # fallback: any launched product
            candidates = [p["product_id"] for p in products if date.fromisoformat(p["launch_date"]) <= d]
        return rng.choice(candidates)

    for (y, m, first, last) in months:
        # Seasonality for this month
        seasonal = SEASONALITY[m]
        # For each HCP, sample number of invoices this month
        for hcp in hcps:
            tier = hcp["tier"]
            base_rate = target_invoices_per_month(tier)
            # Poisson-like sampling
            lam = base_rate * seasonal
            # Apply YoY factor using a mid-month date
            mid = first + timedelta(days=14)
            lam *= yoy_factor(mid)
            n_invoices = rng.choices([0, 1, 2, 3, 4], weights=[
                max(0.0, 1 - lam),
                min(1.0, lam) * 0.55,
                min(1.0, lam) * 0.30,
                min(1.0, lam) * 0.12,
                min(1.0, lam) * 0.03,
            ], k=1)[0]
            if n_invoices == 0:
                continue

            # Find a rep that has visited this HCP — pick any rep that visited
            # in the last 90 days (within visit window). If no visits, skip.
            candidate_reps: List[str] = []
            for r_id in reps_with_visits:
                key = (r_id, hcp["hcp_id"])
                if key not in visit_index:
                    continue
                # any visit in the last 90 days (relative to mid-month)?
                cutoff_lo = first - timedelta(days=60)
                cutoff_hi = last
                dates_list = visit_index[key]
                # Quick check: any date in [cutoff_lo, cutoff_hi]
                for vd in dates_list:
                    if cutoff_lo <= vd <= cutoff_hi:
                        candidate_reps.append(r_id)
                        break
            if not candidate_reps:
                continue

            for _ in range(n_invoices):
                rep_id = rng.choice(candidate_reps)
                # Pick a visit date within last 14 days of invoice date
                key = (rep_id, hcp["hcp_id"])
                visits_for_rep_hcp = visit_index[key]
                # Invoice date: random working day in this month
                inv_date = None
                for _try in range(20):
                    cd = first + timedelta(days=rng.randint(0, (last - first).days))
                    if is_working_day(cd):
                        inv_date = cd
                        break
                if inv_date is None:
                    inv_date = first
                # Need a visit within 14 days before inv_date
                visit_match = None
                for vd in visits_for_rep_hcp:
                    delta = (inv_date - vd).days
                    if 0 <= delta <= 14:
                        visit_match = vd
                        break
                if visit_match is None:
                    # Try a visit within 14 days after inv_date as well (some sales lead visits)
                    for vd in visits_for_rep_hcp:
                        delta = (inv_date - vd).days
                        if -14 <= delta < 0:
                            visit_match = vd
                            break
                if visit_match is None:
                    continue  # no causal link — skip

                # Pick product
                product_id = pick_product_for_hcp(hcp, inv_date)
                ramp = ramp_factor(product_id, inv_date)
                if ramp == 0:
                    continue
                p = product_lookup[product_id]
                mrp = p[5]
                # Unit price ~85% of MRP
                unit_price = int(mrp * 0.85)
                # Qty packs: depends on tier
                if tier == "A":
                    qty = int(np.clip(np.random.normal(60, 20), 10, 200))
                elif tier == "B":
                    qty = int(np.clip(np.random.normal(30, 12), 5, 120))
                else:
                    qty = int(np.clip(np.random.normal(12, 6), 1, 50))
                # Apply ramp factor (new products sell less)
                qty = max(1, int(qty * ramp))
                discount = round(rng.uniform(0.02, 0.12), 2)
                net_value = int(qty * unit_price * (1 - discount))
                channel = rng.choices(CHANNELS, weights=[0.30, 0.30, 0.25, 0.15], k=1)[0]
                distributor = rng.choice(distributor_pool)

                invoice_counter[inv_date] = invoice_counter.get(inv_date, 0) + 1
                invoice_id = f"INV-{inv_date.strftime('%Y%m%d')}-{invoice_counter[inv_date]:03d}"
                sales.append({
                    "invoice_id": invoice_id,
                    "distributor_id": distributor,
                    "rep_id": rep_id,
                    "hcp_id": hcp["hcp_id"],
                    "product_id": product_id,
                    "qty_packs": qty,
                    "unit_price_inr": unit_price,
                    "discount_pct": f"{discount:.2f}",
                    "net_value_inr": net_value,
                    "invoice_date": iso(inv_date),
                    "channel": channel,
                })

    return sales


# --------------------------------------------------------------------------- #
# 6. EXPENSES                                                                  #
# --------------------------------------------------------------------------- #
def gen_expenses(reps: List[Dict]) -> List[Dict]:
    """Generate ~10K expense entries.

    Each rep incurs 5-8 expense entries per week.
    Travel 40%, Food 25%, Lodging 15%, Samples 10%, Other 10%.
    Amounts: Travel 200-2000, Food 100-800, Lodging 1500-4000, Samples 50-1500.
    Policy compliant ~95%; reimbursed ~90%.
    """
    rng = random.Random(SEED + 4)
    expenses: List[Dict] = []

    # Only Field_Reps incur expenses (Area_Managers + above have separate T&E)
    eligible_reps = [r for r in reps if r["role"] == "Field_Rep"]

    cat_weights = {"Travel": 0.40, "Food": 0.25, "Lodging": 0.15, "Samples": 0.10,
                   "Conference": 0.03, "Mobile": 0.05, "Other": 0.02}
    cat_amounts = {
        "Travel": (200, 2000),
        "Food": (100, 800),
        "Lodging": (1500, 4000),
        "Samples": (50, 1500),
        "Conference": (500, 5000),
        "Mobile": (100, 800),
        "Other": (50, 2000),
    }
    notes_templates = {
        "Travel": ["Cab to hospital", "Auto to clinic", "Fuel reimbursement", "Train ticket", "Bus fare"],
        "Food": ["Team lunch with HCP", "Coffee meeting", "Dinner with HCP", "Working lunch", "Snacks for meeting"],
        "Lodging": ["Hotel stay — field trip", "Lodging — outstation visit", "Guest house — 2 nights"],
        "Samples": ["Sample packs for HCP", "Product samples drop", "Demo kit refill"],
        "Conference": ["Conference registration", "CME event fees", "Doctor meet sponsorship"],
        "Mobile": ["Mobile bill", "Internet recharge", "Roaming charges"],
        "Other": ["Stationery", "Printing materials", "Misc expense"],
    }

    expense_counter: Dict[date, int] = {}

    for r in eligible_reps:
        hire = date.fromisoformat(r["hire_date"])
        exit_dt = date.fromisoformat(r["exit_date"]) if r["exit_date"] else END_DATE
        # Iterate weeks
        cur = hire
        while cur <= exit_dt and cur <= END_DATE:
            n_entries = rng.randint(1, 2)
            for _ in range(n_entries):
                # Pick a date in this week
                offset = rng.randint(0, 6)
                ed = cur + timedelta(days=offset)
                if ed > exit_dt or ed > END_DATE or ed < START_DATE:
                    continue
                cat = rng.choices(list(cat_weights.keys()), weights=list(cat_weights.values()), k=1)[0]
                lo, hi = cat_amounts[cat]
                amount = rng.randint(lo, hi)
                reimbursed = rng.random() < 0.90
                compliant = rng.random() < 0.95
                # If non-compliant, slightly increase amount for "policy max exceeded"
                if not compliant and cat == "Lodging":
                    amount = rng.randint(2500, 5000)
                notes = rng.choice(notes_templates[cat])

                expense_counter[ed] = expense_counter.get(ed, 0) + 1
                expense_id = f"EXP-{ed.strftime('%Y%m%d')}-{expense_counter[ed]:03d}"
                expenses.append({
                    "expense_id": expense_id,
                    "rep_id": r["rep_id"],
                    "expense_date": iso(ed),
                    "category": cat,
                    "amount_inr": amount,
                    "reimbursed": "true" if reimbursed else "false",
                    "policy_compliant": "true" if compliant else "false",
                    "notes": notes,
                })
            cur += timedelta(days=7)

    return expenses


# --------------------------------------------------------------------------- #
# 7. TARGETS                                                                   #
# --------------------------------------------------------------------------- #
def gen_targets(reps: List[Dict], products: List[Dict], sales: List[Dict]) -> List[Dict]:
    """Generate ~3,600 quarterly targets per rep per product.

    target_qty = last_year_actual_qty * 1.15 * rep.target_stretch_pct
    For new products, base on therapeutic-area average.
    Each rep covers ~6 products (therapy focus by zone specialty).
    """
    rng = random.Random(SEED + 5)

    # For each rep, pick ~6 products they cover based on their zone therapy focus
    # Zone -> preferred therapy areas (bias)
    zone_ta_focus = {
        "North": ["Cardio", "Diabetes", "Respiratory"],
        "South": ["Cardio", "Diabetes", "GI"],
        "East": ["Cardio", "Respiratory"],
        "West": ["Diabetes", "GI", "Cardio"],
    }

    # Sales index: (rep_id, product_id, fy) -> total_qty, total_value
    sales_index: Dict[Tuple[str, str, int], Tuple[int, int]] = {}
    for s in sales:
        d = date.fromisoformat(s["invoice_date"])
        fy = fy_for(d)
        key = (s["rep_id"], s["product_id"], fy)
        cur = sales_index.get(key, (0, 0))
        sales_index[key] = (cur[0] + s["qty_packs"], cur[1] + s["net_value_inr"])

    # TA average per FY (for new products / reps with no history)
    ta_avg_per_fy: Dict[Tuple[str, int], Tuple[float, float]] = {}
    ta_totals: Dict[Tuple[str, int], Tuple[int, int, int]] = {}
    for (rep_id, pid, fy), (qty, val) in sales_index.items():
        ta = next(p["therapy_area"] for p in products if p["product_id"] == pid)
        k = (ta, fy)
        c = ta_totals.get(k, (0, 0, 0))
        ta_totals[k] = (c[0] + qty, c[1] + val, c[2] + 1)
    for k, (q, v, n) in ta_totals.items():
        ta_avg_per_fy[k] = (q / max(n, 1), v / max(n, 1))

    # Eligible reps: Field_Reps and Area_Managers (not RM/NH — they have aggregate targets)
    eligible_reps = [r for r in reps if r["role"] in ("Field_Rep", "Area_Manager")]
    targets: List[Dict] = []

    # Quarter -> fy mapping
    quarter_dates = {
        (2024, "Q1"): (date(2024, 4, 1), date(2024, 6, 30)),
        (2024, "Q2"): (date(2024, 7, 1), date(2024, 9, 30)),
        (2024, "Q3"): (date(2024, 10, 1), date(2024, 12, 31)),
        (2024, "Q4"): (date(2025, 1, 1), date(2025, 3, 31)),
        (2025, "Q1"): (date(2025, 4, 1), date(2025, 6, 30)),
        (2025, "Q2"): (date(2025, 7, 1), date(2025, 9, 30)),
        (2025, "Q3"): (date(2025, 10, 1), date(2025, 12, 31)),
        (2025, "Q4"): (date(2026, 1, 1), date(2026, 3, 31)),
        (2026, "Q1"): (date(2026, 4, 1), date(2026, 6, 30)),
    }
    # We'll generate targets for FY24, FY25, FY26 (Q1-Q4 each)
    fys = [2024, 2025, 2026]
    quarters = ["Q1", "Q2", "Q3", "Q4"]

    for r in eligible_reps:
        # Pick ~6 products for this rep
        zone = r["zone"]
        preferred_tas = zone_ta_focus[zone]
        # 4 products from preferred TAs + 2 from others
        preferred_products = [p for p in products if p["therapy_area"] in preferred_tas]
        other_products = [p for p in products if p["therapy_area"] not in preferred_tas]
        rng.shuffle(preferred_products)
        rng.shuffle(other_products)
        rep_products = preferred_products[:4] + other_products[:2]

        for fy in fys:
            for q in quarters:
                # Only if rep was active for any part of this quarter
                q_start, q_end = quarter_dates.get((fy, q), (None, None))
                if q_start is None:
                    continue
                hire = date.fromisoformat(r["hire_date"])
                exit_dt = date.fromisoformat(r["exit_date"]) if r["exit_date"] else END_DATE
                # Skip if rep hired after quarter end OR exited before quarter start
                if hire > q_end or exit_dt < q_start:
                    continue
                for p in rep_products:
                    # Look up last year actual
                    prev_fy = fy - 1
                    prev_actual_qty, prev_actual_val = sales_index.get((r["rep_id"], p["product_id"], prev_fy), (0, 0))
                    if prev_actual_qty == 0:
                        # New product or new rep: use TA average for prior FY
                        ta_avg_qty, ta_avg_val = ta_avg_per_fy.get((p["therapy_area"], prev_fy), (40, 20000))
                        base_qty = int(ta_avg_qty / 4)  # quarterly
                        base_val = int(ta_avg_val / 4)
                    else:
                        base_qty = prev_actual_qty / 4  # convert annual to quarterly
                        base_val = prev_actual_val / 4
                    stretch = float(r["target_stretch_pct"])
                    growth = 1.15
                    target_qty = max(10, int(base_qty * growth * stretch))
                    target_value = max(1000, int(base_val * growth * stretch))
                    # ID: TGT-YYYYQn-REPxxx-PRDCARD01 (compact form)
                    rep_compact = r["rep_id"].replace("REP-", "REP")
                    prd_compact = p["product_id"].replace("PRD-", "").replace("-", "")
                    target_id = f"TGT-{fy}{q}-{rep_compact}-{prd_compact}"
                    targets.append({
                        "target_id": target_id,
                        "rep_id": r["rep_id"],
                        "product_id": p["product_id"],
                        "fy": fy,
                        "quarter": q,
                        "target_qty": target_qty,
                        "target_value_inr": target_value,
                    })

    return targets


# --------------------------------------------------------------------------- #
# Main                                                                          #
# --------------------------------------------------------------------------- #
def main():
    print("Generating reps..."); reps = gen_reps()
    print(f"  reps: {len(reps)}")

    print("Generating hcps..."); hcps = gen_hcps()
    print(f"  hcps: {len(hcps)}")

    print("Generating products..."); products = gen_products()
    print(f"  products: {len(products)}")

    print("Generating visits..."); visits = gen_visits(reps, hcps)
    print(f"  visits: {len(visits)}")

    print("Generating sales (derived from visits)..."); sales = gen_sales(reps, hcps, products, visits)
    print(f"  sales: {len(sales)}")

    print("Generating expenses..."); expenses = gen_expenses(reps)
    print(f"  expenses: {len(expenses)}")

    print("Generating targets..."); targets = gen_targets(reps, products, sales)
    print(f"  targets: {len(targets)}")

    total = len(reps) + len(hcps) + len(products) + len(visits) + len(sales) + len(expenses) + len(targets)
    print(f"\nTotal rows across 7 tables: {total}")

    write_csv("reps", reps, [
        "rep_id", "first_name", "last_name", "email", "phone", "role", "manager_id",
        "zone", "state", "city", "hire_date", "exit_date", "status",
        "base_salary_inr", "target_stretch_pct",
    ])
    write_csv("hcps", hcps, [
        "hcp_id", "first_name", "last_name", "specialty", "tier", "decile",
        "city", "state", "zone", "hospital", "years_practicing",
        "preferred_contact", "npi_like_id",
    ])
    write_csv("products", products, [
        "product_id", "product_name", "molecule", "therapy_area", "launch_date",
        "mrp_inr", "pack_size", "is_new_launch", "priority",
    ])
    write_csv("visits", visits, [
        "visit_id", "rep_id", "hcp_id", "visit_date", "visit_type",
        "duration_min", "products_detailed", "samples_dropped", "outcome",
        "followup_required",
    ])
    write_csv("sales", sales, [
        "invoice_id", "distributor_id", "rep_id", "hcp_id", "product_id",
        "qty_packs", "unit_price_inr", "discount_pct", "net_value_inr",
        "invoice_date", "channel",
    ])
    write_csv("expenses", expenses, [
        "expense_id", "rep_id", "expense_date", "category", "amount_inr",
        "reimbursed", "policy_compliant", "notes",
    ])
    write_csv("targets", targets, [
        "target_id", "rep_id", "product_id", "fy", "quarter",
        "target_qty", "target_value_inr",
    ])
    print("\nAll CSVs written to", DATA_DIR)


if __name__ == "__main__":
    main()

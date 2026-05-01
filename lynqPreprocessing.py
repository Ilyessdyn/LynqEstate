"""
Lynq Estate — Data Preprocessor
Transforms raw laval_house_sales.csv into a clean ML-ready dataset.

Input:  laval_house_sales.csv  (raw scraper output)
Output: laval_ml_ready.csv     (clean, model-ready)
"""

import pandas as pd

INPUT_CSV  = "montreal_properties.csv"
OUTPUT_CSV = "montreal_ml_ready.csv"

# ── Load ──────────────────────────────────────────────────────────────────────
df = pd.read_csv(INPUT_CSV)
print(f"Loaded {len(df)} rows")

# ── Drop rows with no sale amount (target variable) ───────────────────────────
df = df[df["sale_amount"].notna() & (df["sale_amount"] > 0)]
print(f"After removing missing sale_amount: {len(df)} rows")

# ── Set id as index ───────────────────────────────────────────────────────────
df = df.set_index("id")

# ── Drop columns not useful for the model ─────────────────────────────────────
df = df.drop(columns=[
    "street",            # too granular, messy text
    "zip_code",          # lat/lon is more precise
    "owner_type",        # weak signal
    "agricultural_zone", # almost all "fully_excluded", no variance
    "tile_lat_sw",       # scraping artifact
    "tile_lon_sw",       # scraping artifact
])

# ── Engineer sale_year and sale_month from sale_date ──────────────────────────
df["sale_date"]  = pd.to_datetime(df["sale_date"], errors="coerce")
df["sale_year"]  = df["sale_date"].dt.year
df["sale_month"] = df["sale_date"].dt.month
df = df.drop(columns=["sale_date"])

# ── One-hot encode city ───────────────────────────────────────────────────────
df["city"] = df["city"].str.strip().str.title()
city_dummies = pd.get_dummies(df["city"], prefix="city")
df = pd.concat([df.drop(columns=["city"]), city_dummies], axis=1)

# ── One-hot encode other categorical columns ──────────────────────────────────
for col in ["physical_link", "building_type", "property_type"]:
    dummies = pd.get_dummies(df[col], prefix=col)
    df = pd.concat([df.drop(columns=[col]), dummies], axis=1)

# ── Convert boolean columns to int (0/1) ─────────────────────────────────────
bool_cols = df.select_dtypes(include="bool").columns
df[bool_cols] = df[bool_cols].astype(int)

# ── Drop rows missing critical features ───────────────────────────────────────
critical = ["floor_area", "latitude", "longitude", "total_assessed_value"]
before = len(df)
df = df.dropna(subset=critical)
print(f"Dropped {before - len(df)} rows with missing critical features")

# ── Move sale_amount to the last column (target variable) ─────────────────────
cols = [c for c in df.columns if c != "sale_amount"] + ["sale_amount"]
df = df[cols]

# ── Save ──────────────────────────────────────────────────────────────────────
df.to_csv(OUTPUT_CSV)
print(f"\nDone! {len(df)} clean rows saved to '{OUTPUT_CSV}'")
print(f"Shape: {df.shape[0]} rows x {df.shape[1]} columns")
print(f"\nColumns:\n{list(df.columns)}")

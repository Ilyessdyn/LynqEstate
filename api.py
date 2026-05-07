"""
LynqEstate — Prediction API
Run with: uvicorn api:app --reload
Docs at:  http://localhost:8000/docs
"""

import joblib
import lightgbm as lgb
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from fastapi.middleware.cors import CORSMiddleware

# ── Load all three models at startup ─────────────────────────────────────────
MODELS = {}
for pt in ["unifamilial", "condo", "plex"]:
    try:
        model = lgb.Booster(model_file=f"lynq_model_{pt}.lgb")
        pkl_data = joblib.load(f"lynq_model_{pt}.pkl")
        MODELS[pt] = {
            "model":    model,
            "imputer":  pkl_data["imputer"],
            "features": pkl_data["features"],
        }
        print(f"✓ {pt} model loaded — {len(pkl_data['features'])} features")
    except Exception as e:
        raise RuntimeError(f"Failed to load {pt} model: {e}")
 
# ── Confidence margins per model — based on actual MAPE ──────────────────────
# Condo is tighter (8.72% MAPE), plex is wider (17% MAPE)
MARGINS = {
    "unifamilial": 0.10,
    "condo":       0.07,
    "plex":        0.15,
}
 
# ── All cities the model knows about ─────────────────────────────────────────
KNOWN_CITIES = [
    "Baie-D'Urfé", "Beaconsfield", "Blainville", "Bois-Des-Filion",
    "Boisbriand", "Boucherville", "Brossard", "Candiac", "Carignan",
    "Charlemagne", "Côte-Saint-Luc", "Delson", "Deux-Montagnes",
    "Dollard-Des-Ormeaux", "Dorval", "Gore", "Hampstead", "Hudson",
    "Kirkland", "L'Assomption", "L'Épiphanie", "L'Île-Cadieux",
    "L'Île-Dorval", "L'Île-Perrot", "La Prairie", "Laval", "Longueuil",
    "Lorraine", "Mascouche", "Mille-Isles", "Mirabel", "Mont-Royal",
    "Montréal", "Montréal-Est", "Montréal-Ouest", "Oka", "Piedmont",
    "Pointe-Calumet", "Pointe-Claire", "Prévost", "Repentigny", "Rosemère",
    "Saint-Bruno-De-Montarville", "Saint-Colomban", "Saint-Esprit",
    "Saint-Eustache", "Saint-Hippolyte", "Saint-Jean-Sur-Richelieu",
    "Saint-Joseph-Du-Lac", "Saint-Jérôme", "Saint-Lambert", "Saint-Lazare",
    "Saint-Lin–Laurentides", "Saint-Placide", "Saint-Roch-De-L'Achigan",
    "Saint-Roch-Ouest", "Saint-Sauveur", "Saint-Sulpice", "Sainte-Anne-De-Bellevue",
    "Sainte-Anne-Des-Lacs", "Sainte-Anne-Des-Plaines", "Sainte-Catherine",
    "Sainte-Marthe-Sur-Le-Lac", "Sainte-Sophie", "Sainte-Thérèse", "Senneville",
    "Terrebonne", "Varennes", "Vaudreuil-Dorion", "Vaudreuil-Sur-Le-Lac",
    "Verchères", "Westmount",
]
 
VALID_PROPERTY_TYPES = ["unifamilial", "condo", "plex"]
VALID_PHYSICAL_LINKS = ["detached", "integrated", "rowhouse-1-side",
                        "rowhouse-more-than-1-side", "semi-detached"]
VALID_BUILDING_TYPES = ["full-story", "mansard", "single-story",
                        "single-wide", "split-level"]
 
# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="LynqEstate API",
    description="ML-powered real estate price estimation for the Greater Montréal and Laval area, trained on 200,000+ properties.",
    version="2.0",
)
 
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://lynq-estate.vercel.app",
        "https://lynqestate.com",
        "https://www.lynqestate.com",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)
 
# ── Input schema ──────────────────────────────────────────────────────────────
class PropertyInput(BaseModel):
    longitude:               float = Field(..., example=-73.57)
    latitude:                float = Field(..., example=45.50)
    city:                    str   = Field(..., example="Montréal")
    floor_count:             int   = Field(..., example=2,      ge=1, le=10)
    floor_area:              float = Field(..., example=1200.0, gt=0)
    housing_count:           int   = Field(..., example=1,      ge=1)
    parcel_area:             float = Field(..., example=3000.0, gt=0)
    year_built:              int   = Field(..., example=1995,   ge=1800, le=2025)
    previous_assessed_value: int   = Field(..., example=480000, gt=0)
    total_assessed_value:    int   = Field(..., example=530000, gt=0)
    sale_year:               int   = Field(..., example=2024,   ge=2000, le=2030)
    sale_month:              int   = Field(..., example=6,      ge=1, le=12)
    physical_link:           str   = Field(..., example="detached")
    building_type:           str   = Field(..., example="full-story")
    property_type:           str   = Field(..., example="unifamilial")
 
# ── Output schema ─────────────────────────────────────────────────────────────
class PredictionOutput(BaseModel):
    estimate:       int
    range_low:      int
    range_high:     int
    confidence:     str
    currency:       str = "CAD"
    model_version:  str = "v2"
    model_used:     str
    plex_note:      str = ""   # populated with disclaimer for plex predictions
 
# ── Feature builder ───────────────────────────────────────────────────────────
def build_feature_row(prop: PropertyInput, features: list) -> pd.DataFrame:
    row = {feature: 0 for feature in features}
 
    row["longitude"]               = prop.longitude
    row["latitude"]                = prop.latitude
    row["floor_count"]             = prop.floor_count
    row["floor_area"]              = prop.floor_area
    row["housing_count"]           = prop.housing_count
    row["parcel_area"]             = prop.parcel_area
    row["year_built"]              = prop.year_built
    row["previous_assessed_value"] = prop.previous_assessed_value
    row["total_assessed_value"]    = prop.total_assessed_value
    row["sale_year"]               = prop.sale_year
    row["sale_month"]              = prop.sale_month
 
    row["assessed_value_gap"]    = prop.total_assessed_value - prop.previous_assessed_value
    row["assessed_per_sqft"]     = prop.total_assessed_value / (prop.floor_area + 1)
    row["property_age"]          = prop.sale_year - prop.year_built
    row["assessment_growth_pct"] = (
        (prop.total_assessed_value - prop.previous_assessed_value)
        / (prop.previous_assessed_value + 1)
    )
    row["local_assessed_median"] = prop.total_assessed_value
 
    city_col = f"city_{prop.city}"
    if city_col in row:
        row[city_col] = 1
 
    physical_col = f"physical_link_{prop.physical_link}"
    if physical_col in row:
        row[physical_col] = 1
 
    building_col = f"building_type_{prop.building_type}"
    if building_col in row:
        row[building_col] = 1
 
    property_col = f"property_type_{prop.property_type}"
    if property_col in row:
        row[property_col] = 1
 
    return pd.DataFrame([row])
 
# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {
        "service": "LynqEstate API",
        "version": "2.0",
        "status":  "running",
        "models":  list(MODELS.keys()),
        "docs":    "/docs",
    }
 
@app.get("/health")
def health():
    return {
        "status":        "ok",
        "models_loaded": list(MODELS.keys()),
    }
 
@app.get("/cities")
def list_cities():
    return {"cities": sorted(KNOWN_CITIES)}
 
@app.post("/predict", response_model=PredictionOutput)
def predict(prop: PropertyInput):
 
    # Validate city
    if prop.city not in KNOWN_CITIES:
        raise HTTPException(
            status_code=400,
            detail=f"City '{prop.city}' not recognized. Call /cities for the full list."
        )
 
    # Validate property type — indéterminé no longer supported
    if prop.property_type not in VALID_PROPERTY_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"property_type must be one of: {VALID_PROPERTY_TYPES}"
        )
 
    # Validate physical link
    if prop.physical_link not in VALID_PHYSICAL_LINKS:
        raise HTTPException(
            status_code=400,
            detail=f"physical_link must be one of: {VALID_PHYSICAL_LINKS}"
        )
 
    # Validate building type
    if prop.building_type not in VALID_BUILDING_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"building_type must be one of: {VALID_BUILDING_TYPES}"
        )
 
    # Plex — reject 7+ unit buildings, not supported
    if prop.property_type == "plex" and prop.housing_count > 6:
        raise HTTPException(
            status_code=400,
            detail="Large plex properties (7+ units) are not currently supported."
        )
 
    # Route to the correct model
    model_data = MODELS[prop.property_type]
    model      = model_data["model"]
    imputer    = model_data["imputer"]
    features   = model_data["features"]
 
    # Build and impute feature row
    X = build_feature_row(prop, features)
    X_imputed = pd.DataFrame(imputer.transform(X), columns=X.columns)
 
    # Predict
    raw_prediction = model.predict(X_imputed.values)[0]
    estimate = int(round(raw_prediction / 1000) * 1000)
 
    # Per-model confidence margin
    margin     = MARGINS[prop.property_type]
    range_low  = int(round(estimate * (1 - margin) / 1000) * 1000)
    range_high = int(round(estimate * (1 + margin) / 1000) * 1000)
 
    # Confidence label
    assessment_ratio = prop.total_assessed_value / estimate if estimate > 0 else 1
    if 0.7 <= assessment_ratio <= 1.3:
        confidence = "high"
    elif 0.5 <= assessment_ratio <= 1.5:
        confidence = "medium"
    else:
        confidence = "low"
 
    # Plex disclaimer
    plex_note = ""
    if prop.property_type == "plex":
        plex_note = "Plex valuations are estimates only. Rental income, lease terms, and vacancy rates significantly affect market value and are not captured in this model."
 
    return PredictionOutput(
        estimate=estimate,
        range_low=range_low,
        range_high=range_high,
        confidence=confidence,
        model_used=prop.property_type,
        plex_note=plex_note,
    )


# ─────────────────────────────────────────────────────────────────────────────
# MARKET INTELLIGENCE ENDPOINTS
# Add these imports at the top of api.py (if not already present):
#   import os
#   from functools import lru_cache
#
# Add this block AFTER the existing routes in api.py
# ─────────────────────────────────────────────────────────────────────────────

import os
from functools import lru_cache

# ── Load market dataset at startup ───────────────────────────────────────────
MARKET_DF: pd.DataFrame | None = None

def load_market_data():
    global MARKET_DF
    for fname in ["/data/montreal_ml_ready.csv", "montreal_ml_ready.csv", "laval_ml_ready.csv"]:
        if os.path.exists(fname):
            df = pd.read_csv(fname)
            df.columns = [c.lower() for c in df.columns]
            if "sale_amount" in df.columns:
                df = df[df["sale_amount"].notna() & (df["sale_amount"] > 0)]
                if "city" not in df.columns:
                    city_cols = [c for c in df.columns if c.startswith("city_")]
                    if city_cols:
                        df["city"] = df[city_cols].idxmax(axis=1).str.replace("city_", "", regex=False)
                MARKET_DF = df
                print(f"✓ Market data loaded from {fname} — {len(df):,} rows")
                return
    print("⚠️  No market CSV found — /market endpoints will return 503")

load_market_data()


def _require_market():
    if MARKET_DF is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail="Market data not available.")
    return MARKET_DF


# ── Helper: compute market trend from last two 3-month windows ───────────────
def _compute_trend(df: pd.DataFrame):
    """
    Compare median sale_amount in the last 3 months of the dataset
    vs the 3 months before that.
    Returns (trend_label, change_pct, consecutive_quarters_up).
    """
    if "sale_year" not in df.columns or "sale_month" not in df.columns:
        return "Stable", 0.0, 0

    df = df.copy()
    df["period"] = df["sale_year"] * 100 + df["sale_month"]  # e.g. 202406
    max_period = df["period"].max()

    # Decode max period
    max_year  = max_period // 100
    max_month = max_period % 100

    def months_back(n):
        """Return period value n months before max."""
        m = max_month - n
        y = max_year
        while m <= 0:
            m += 12
            y -= 1
        return y * 100 + m

    cutoff_recent   = months_back(3)   # 3 months ago
    cutoff_previous = months_back(6)   # 6 months ago

    recent   = df[df["period"] >  cutoff_recent]["sale_amount"].median()
    previous = df[(df["period"] > cutoff_previous) & (df["period"] <= cutoff_recent)]["sale_amount"].median()

    if pd.isna(recent) or pd.isna(previous) or previous == 0:
        return "Stable", 0.0, 0

    change_pct = (recent - previous) / previous * 100

    if change_pct > 2:
        trend = "Rising"
    elif change_pct < -2:
        trend = "Falling"
    else:
        trend = "Stable"

    # Count consecutive rising quarters (up to last 4)
    quarters = []
    for i in range(4):
        start = months_back(3 * (i + 1))
        end   = months_back(3 * i)
        window = df[(df["period"] > start) & (df["period"] <= end)]["sale_amount"].median()
        quarters.append(window)

    consecutive = 0
    for j in range(len(quarters) - 1):
        if not pd.isna(quarters[j]) and not pd.isna(quarters[j + 1]) and quarters[j] > quarters[j + 1]:
            consecutive += 1
        else:
            break

    return trend, round(change_pct, 2), consecutive


# ── GET /market/summary ───────────────────────────────────────────────────────
@app.get("/market/summary")
def market_summary():
    """Hero stats: median price, price/sqft, transaction count, most active city, trend."""
    df = _require_market()

    median_price = int(df["sale_amount"].median())

    # Price per sq ft
    price_per_sqft = None
    if "floor_area" in df.columns:
        valid = df[(df["floor_area"] > 100) & (df["floor_area"] < 20000)].copy()
        valid["ppsf"] = valid["sale_amount"] / (valid["floor_area"] * 10.764)
        price_per_sqft = round(valid["ppsf"].median(), 0)

    # Most active city
    most_active_city = None
    most_active_pct  = None
    if "city" in df.columns:
        city_counts      = df["city"].value_counts()
        most_active_city = city_counts.idxmax()
        most_active_pct  = round(city_counts.max() / len(df) * 100, 1)

    # YoY change
    yoy_change = None
    if "sale_year" in df.columns:
        max_year  = int(df["sale_year"].max())
        prev_year = max_year - 1
        cur_med   = df[df["sale_year"] == max_year]["sale_amount"].median()
        prev_med  = df[df["sale_year"] == prev_year]["sale_amount"].median()
        if not pd.isna(cur_med) and not pd.isna(prev_med) and prev_med > 0:
            yoy_change = round((cur_med - prev_med) / prev_med * 100, 2)

    trend, trend_change_pct, consecutive_quarters = _compute_trend(df)

    return {
        "median_price":        median_price,
        "price_per_sqft":      price_per_sqft,
        "total_transactions":  len(df),
        "most_active_city":    most_active_city,
        "most_active_pct":     most_active_pct,
        "yoy_change_pct":      yoy_change,
        "market_trend":        trend,
        "trend_change_pct":    trend_change_pct,
        "consecutive_quarters": consecutive_quarters,
    }


# ── GET /market/trends ────────────────────────────────────────────────────────
@app.get("/market/trends")
def market_trends():
    """Monthly median sale price over time — for the line chart."""
    df = _require_market()

    if "sale_year" not in df.columns or "sale_month" not in df.columns:
        raise HTTPException(status_code=422, detail="sale_year / sale_month columns missing.")

    grouped = (
        df.groupby(["sale_year", "sale_month"])["sale_amount"]
        .agg(median="median", count="count")
        .reset_index()
    )
    grouped = grouped[grouped["count"] >= 5]  # skip sparse months
    grouped = grouped.sort_values(["sale_year", "sale_month"])

    return {
        "data": [
            {
                "year":   int(r["sale_year"]),
                "month":  int(r["sale_month"]),
                "label":  f"{int(r['sale_year'])}-{int(r['sale_month']):02d}",
                "median": int(r["median"]),
                "count":  int(r["count"]),
            }
            for _, r in grouped.iterrows()
        ]
    }


# ── GET /market/by-city ───────────────────────────────────────────────────────
@app.get("/market/by-city")
def market_by_city():
    """Median price, transaction count, and price/sqft per city — for heatmap + table."""
    df = _require_market()

    if "city" not in df.columns:
        raise HTTPException(status_code=422, detail="city column missing.")

    agg = (
        df.groupby("city")["sale_amount"]
        .agg(median_price="median", count="count")
        .reset_index()
    )

    # YoY per city
    yoy_map = {}
    if "sale_year" in df.columns:
        max_year  = int(df["sale_year"].max())
        prev_year = max_year - 1
        for city, grp in df.groupby("city"):
            cur  = grp[grp["sale_year"] == max_year]["sale_amount"].median()
            prev = grp[grp["sale_year"] == prev_year]["sale_amount"].median()
            if not pd.isna(cur) and not pd.isna(prev) and prev > 0:
                yoy_map[city] = round((cur - prev) / prev * 100, 2)

    # Price per sqft per city
    ppsf_map = {}
    if "floor_area" in df.columns:
        valid = df[(df["floor_area"] > 100) & (df["floor_area"] < 20000)].copy()
        valid["ppsf"] = valid["sale_amount"] / (valid["floor_area"] * 10.764)
        for city, grp in valid.groupby("city"):
            ppsf_map[city] = round(grp["ppsf"].median(), 0)

    agg = agg[agg["count"] >= 10].sort_values("median_price", ascending=False)

    return {
        "data": [
            {
                "city":         row["city"],
                "median_price": int(row["median_price"]),
                "count":        int(row["count"]),
                "yoy_change":   yoy_map.get(row["city"]),
                "price_per_sqft": ppsf_map.get(row["city"]),
            }
            for _, row in agg.iterrows()
        ]
    }


# ── GET /market/by-type ───────────────────────────────────────────────────────
@app.get("/market/by-type")
def market_by_type():
    """Median price per property type — for the bar chart."""
    df = _require_market()

    type_col = None
    for col in ["property_type", "building_type"]:
        if col in df.columns:
            type_col = col
            break

    if type_col is None:
        raise HTTPException(status_code=422, detail="No property_type or building_type column found.")

    agg = (
        df.groupby(type_col)["sale_amount"]
        .agg(median_price="median", count="count")
        .reset_index()
    )
    agg = agg[agg["count"] >= 10].sort_values("median_price", ascending=False)

    return {
        "type_column": type_col,
        "data": [
            {
                "type":         row[type_col],
                "median_price": int(row["median_price"]),
                "count":        int(row["count"]),
            }
            for _, row in agg.iterrows()
        ]
    }


# ── GET /market/volume ────────────────────────────────────────────────────────
@app.get("/market/volume")
def market_volume():
    """Transaction count by month (1–12) — for the seasonality bar chart."""
    df = _require_market()

    if "sale_month" not in df.columns:
        raise HTTPException(status_code=422, detail="sale_month column missing.")

    counts = df.groupby("sale_month").size().reset_index(name="count")
    month_names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

    result = []
    for m in range(1, 13):
        row = counts[counts["sale_month"] == m]
        result.append({
            "month":  m,
            "label":  month_names[m - 1],
            "count":  int(row["count"].values[0]) if len(row) else 0,
        })

    return {"data": result}
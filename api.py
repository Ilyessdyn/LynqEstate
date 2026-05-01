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
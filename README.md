LynqEstate
ML-powered real estate valuation for Greater Montréal and Laval.
Instant price estimates based on 200,000+ real transactions. No agent. No commitment.
🌐 Live at lynqestate.com

What it does
LynqEstate lets anyone estimate the market value of a property in the Greater Montréal area in under 60 seconds. Enter an address, fill in a few property details, and get an ML-powered estimate with a confidence range — no realtor, no waiting.

Stack
LayerTechnologyMLLightGBM, scikit-learn, pandasBackendFastAPI, Python 3.11, DockerFrontendNext.js 16, TypeScript, Tailwind CSSDeploymentRailway (API) + Vercel (frontend)Address AutocompleteGoogle Maps Places API

Model Architecture
Rather than a single unified model, LynqEstate trains separate LightGBM models per property type. This was a deliberate decision: condos, unifamilial homes, and plexes have fundamentally different pricing dynamics and feature distributions. A single model was found to underfit all three.
Performance
Property TypeRowsMAPEMAECondo38,5918.72%$41,228Unifamilial99,27813.51%~$75,000Plex29,81617.29%$112,564
Key modeling decisions
Condo (8.72% MAPE): The best-performing segment. Condos have consistent features and comparable pricing within buildings, making them more predictable.
Unifamilial (13.51% MAPE): Three segment-specific cleaning steps were applied — a tighter 99.5th percentile price cap to remove ultra-luxury outliers, removal of properties with zero floor area (API data gaps), and exclusion of single-wide mobile homes (a fundamentally different asset class that distorted the distribution).
Plex (17.29% MAPE): The hardest segment. Plex pricing depends heavily on rental income, lease terms, and vacancy rates — none of which are available in the dataset. This is a data ceiling, not a model problem. A disclaimer is shown in the UI.
Feature engineering
Beyond raw features, the model uses engineered signals:

assessed_value_gap — delta between current and previous municipal assessment
assessment_growth_pct — percentage growth in assessed value
assessed_per_sqft — assessed value normalized by floor area
property_age — derived from year built and sale year
local_assessed_median — median assessed value at the same coordinates


Data Pipeline

Raw property and transaction data collected for the Greater Montréal area
lynqPreprocessing.py cleans, filters, and one-hot encodes categorical features
lynq_model.py trains per-segment LightGBM models with early stopping
Models are serialized in LightGBM's native .lgb format for cross-platform compatibility

Data quality filters applied

Removed transactions below $200,000 (non-market sales)
Removed outliers above the 99.7th percentile
Removed non-arm's-length transactions (sale/assessment ratio outside 0.5–2.0)
Removed properties with zero assessed value
Removed ambiguous indéterminé property type entries


API
The FastAPI backend exposes a /predict endpoint that accepts property details and returns an estimate with confidence range.
bashPOST /predict
json{
  "property_type": "unifamilial",
  "city": "Montréal",
  "floor_area": 1400,
  "total_assessed_value": 520000,
  "previous_assessed_value": 480000,
  ...
}
Response:
json{
  "estimate": 612000,
  "range_low": 551000,
  "range_high": 673000,
  "confidence": "high",
  "model_version": "v2",
  "model_used": "unifamilial"
}
Confidence margins: condo ±7%, unifamilial ±10%, plex ±15% — calibrated to actual MAPE.

Local Development
Backend
bashpython -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn api:app --reload
Frontend
bashcd frontend
npm install
npm run dev
Add a frontend/.env.local file:
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
NEXT_PUBLIC_GOOGLE_PLACES_KEY=your_key_here

Deployment

API: Dockerized FastAPI on Railway, auto-deploys on push to main
Frontend: Vercel, auto-deploys on push to main


Built as a full-stack ML project exploring automated valuation models (AVMs) for the Quebec real estate market.

# LynqEstate

ML-powered real estate valuation for Greater Montréal and Laval.  
Trained on 200,000+ real transactions. No agent. No commitment.

## Stack
- **ML:** LightGBM, scikit-learn, pandas
- **API:** FastAPI (Python)
- **Frontend:** Next.js 16, TypeScript, Tailwind CSS

## Model Performance
| Property Type | MAPE | MAE |
|---|---|---|
| Condo | 8.72% | $41,228 |
| Unifamilial | 13.51% | ~$75,000 |
| Plex | 17.29% | $112,564 |

## Architecture
Separate LightGBM models per property type, trained on municipal assessment data and historical transaction records for the Greater Montréal area.

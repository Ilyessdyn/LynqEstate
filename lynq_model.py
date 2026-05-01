"""
LynqEstate — ML Modeling Pipeline (Split by Property Type)
Trains one LightGBM model per property type: unifamilial, condo, plex.
Outputs: MAPE per model, feature importance, and saved model files.
"""
 
import numpy as np
import pandas as pd
import lightgbm as lgb
import matplotlib.pyplot as plt
 
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_percentage_error
from sklearn.impute import SimpleImputer
 
import warnings
import joblib
 
warnings.filterwarnings("ignore")
 
# ── Config ────────────────────────────────────────────────────────────────────
DATA_PATH      = "montreal_ml_ready.csv"
TARGET         = "sale_amount"
DROP_COLS      = ["id"]
OUTLIER_CAP    = 0.997
FLOOR_VALUE    = 200_000
TEST_SIZE      = 0.15
VAL_SIZE       = 0.15
RANDOM_STATE   = 42
 
PROPERTY_TYPES = ["unifamilial", "condo", "plex"]
 
# One model file per property type
MODEL_OUT = {
    "unifamilial": "lynq_model_unifamilial.pkl",
    "condo":       "lynq_model_condo.pkl",
    "plex":        "lynq_model_plex.pkl",
}
 
PARAMS = {
    "objective":         "regression",
    "metric":            "mape",
    "boosting_type":     "gbdt",
    "n_estimators":      3000,
    "learning_rate":     0.03,
    "num_leaves":        128,
    "max_depth":         -1,
    "min_child_samples": 15,
    "feature_fraction":  0.8,
    "bagging_fraction":  0.8,
    "bagging_freq":      5,
    "lambda_l1":         0.1,
    "lambda_l2":         0.1,
    "verbose":           -1,
    "random_state":      RANDOM_STATE,
}
 
# ── Load ──────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("  LynqEstate — Split Model Training Pipeline")
print("="*60)
 
print("\n[1/3] Loading data...")
df = pd.read_csv(DATA_PATH)
print(f"      Shape: {df.shape}")
 
# Drop non-feature columns
df.drop(columns=[c for c in DROP_COLS if c in df.columns], inplace=True)
 
# ── Global cleaning ───────────────────────────────────────────────────────────
print("\n[2/3] Cleaning...")
 
cap_value = df[TARGET].quantile(OUTLIER_CAP)
df = df[df[TARGET] <= cap_value].copy()
print(f"      Outlier cap: ${cap_value:,.0f}")
 
df = df[df[TARGET] >= FLOOR_VALUE].copy()
print(f"      Floor: ${FLOOR_VALUE:,}")
 
df = df[df["total_assessed_value"] > 0].copy()
print(f"      Removed zero assessed value rows")
 
df["temp_ratio"] = df["sale_amount"] / df["total_assessed_value"]
df = df[(df["temp_ratio"] >= 0.5) & (df["temp_ratio"] <= 2.0)].copy()
df.drop(columns=["temp_ratio"], inplace=True)
print(f"      Removed non-arm's-length transactions")
 
# Drop indéterminé — ambiguous property type, not useful
before = len(df)
df = df[df["property_type_indéterminé"] != 1].copy() if "property_type_indéterminé" in df.columns else df
print(f"      Dropped {before - len(df)} indéterminé rows")
print(f"      Remaining rows: {len(df):,}")
 
# ── Feature engineering ───────────────────────────────────────────────────────
df["assessed_value_gap"]     = df["total_assessed_value"] - df["previous_assessed_value"]
df["assessment_growth_pct"]  = (df["total_assessed_value"] - df["previous_assessed_value"]) / (df["previous_assessed_value"] + 1)
df["local_assessed_median"]  = df.groupby(["latitude", "longitude"])["total_assessed_value"].transform("median")
df["assessed_per_sqft"]      = df["total_assessed_value"] / (df["floor_area"] + 1)
df["property_age"]           = df["sale_year"] - df["year_built"]
df["property_age"]           = df["property_age"].clip(0, 150)
 
# ── Train one model per property type ─────────────────────────────────────────
print("\n[3/3] Training models...\n")
 
results = {}
 
for pt in PROPERTY_TYPES:
 
    print(f"{'='*60}")
    print(f"  Property type: {pt.upper()}")
    print(f"{'='*60}")
 
    # Filter to this property type using the one-hot column
    col = f"property_type_{pt}"
    if col not in df.columns:
        print(f"  Column '{col}' not found — skipping\n")
        continue
 
    subset = df[df[col] == 1].copy()
    print(f"  Rows (raw): {len(subset):,}")
 
    # ── Unifamilial-specific cleaning ─────────────────────────────────────────
    if pt == "unifamilial":
        # 1. Tighter price cap — the global 99.7th lets $18M+ mansions through
        #    which are genuinely different products from the typical detached home.
        unifam_cap = subset[TARGET].quantile(0.995)
        before_cap = len(subset)
        subset = subset[subset[TARGET] <= unifam_cap].copy()
        print(f"  Unifamilial cap at 99.5th percentile: ${unifam_cap:,.0f} — removed {before_cap - len(subset)} rows")
 
        # 2. Drop zero floor_area — these are API data gaps, not real properties.
        #    Keeping them poisons assessed_per_sqft and confuses the model.
        before_area = len(subset)
        subset = subset[subset["floor_area"] > 0].copy()
        print(f"  Dropped {before_area - len(subset)} rows with floor_area = 0")
 
        # 3. Drop single-wide mobile homes — fundamentally different asset class,
        #    too few to train well and they distort the detached-home distribution.
        if "building_style_single-wide" in subset.columns:
            before_sw = len(subset)
            subset = subset[subset["building_style_single-wide"] != 1].copy()
            print(f"  Dropped {before_sw - len(subset)} single-wide mobile homes")
        else:
            print(f"  'building_style_single-wide' column not found — skipping")
 
    # ── Plex-specific cleaning ─────────────────────────────────────────────────
    if pt == "plex":
        plex_cap = subset[TARGET].quantile(0.995)
        before_cap = len(subset)
        subset = subset[subset[TARGET] <= plex_cap].copy()
        print(f"  Plex cap at 99.5th percentile: ${plex_cap:,.0f} — removed {before_cap - len(subset)} rows")
 
        # plex_tier — duplex vs mid vs large — key signal the model was missing
        subset["plex_tier"] = pd.cut(
            subset["housing_count"],
            bins=[0, 3, 6, 999],
            labels=[1, 2, 3]
        ).astype(int)
        print(f"  Plex tier distribution:\n{subset['plex_tier'].value_counts().sort_index().to_string()}")
 
    print(f"  Rows (clean): {len(subset):,}")
 
    if len(subset) < 5000:
        print(f"  WARNING: only {len(subset):,} rows — model may be unreliable\n")
 
    X = subset.drop(columns=[TARGET])
    y = subset[TARGET]
 
    imputer = SimpleImputer(strategy="median")
    X_imputed = pd.DataFrame(imputer.fit_transform(X), columns=X.columns)
 
    # Train / val / test split
    X_temp, X_test, y_temp, y_test = train_test_split(
        X_imputed, y, test_size=TEST_SIZE, random_state=RANDOM_STATE
    )
    val_ratio = VAL_SIZE / (1 - TEST_SIZE)
    X_train, X_val, y_train, y_val = train_test_split(
        X_temp, y_temp, test_size=val_ratio, random_state=RANDOM_STATE
    )
 
    print(f"  Train: {len(X_train):,} | Val: {len(X_val):,} | Test: {len(X_test):,}")
 
    # Train
    model = lgb.LGBMRegressor(**PARAMS)
    model.fit(
        X_train, y_train,
        eval_set=[(X_val, y_val)],
        callbacks=[
            lgb.early_stopping(stopping_rounds=50, verbose=False),
            lgb.log_evaluation(period=200),
        ],
    )
    print(f"  Best iteration: {model.best_iteration_}")
 
    # Evaluate
    y_pred_test  = model.predict(X_test)
    y_pred_train = model.predict(X_train)
 
    mape_train = mean_absolute_percentage_error(y_train, y_pred_train) * 100
    mape_test  = mean_absolute_percentage_error(y_test,  y_pred_test)  * 100
    mae_test   = np.mean(np.abs(y_test.values - y_pred_test))
 
    print(f"\n  Train MAPE: {mape_train:.2f}%")
    print(f"  Test MAPE:  {mape_test:.2f}%  ← headline number")
    print(f"  Test MAE:   ${mae_test:,.0f}")
 
    results[pt] = {"mape": mape_test, "mae": mae_test, "rows": len(subset)}
 
    # Feature importance
    importance = pd.DataFrame({
        "feature":    X_train.columns,
        "importance": model.feature_importances_,
    }).sort_values("importance", ascending=False)
 
    print(f"\n  Top 10 features:")
    print(importance.head(10).to_string(index=False))
 
    # Save model
    out_path = MODEL_OUT[pt]
    joblib.dump({
        "model":    model,
        "imputer":  imputer,
        "features": list(X_train.columns),
        "property_type": pt,
    }, out_path)
    print(f"\n  Saved → {out_path}\n")
 
# ── Summary ───────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("  FINAL SUMMARY")
print("="*60)
print(f"  {'Type':<15} {'Rows':>8}  {'MAPE':>8}  {'MAE':>12}")
print(f"  {'-'*15} {'-'*8}  {'-'*8}  {'-'*12}")
for pt, r in results.items():
    print(f"  {pt:<15} {r['rows']:>8,}  {r['mape']:>7.2f}%  ${r['mae']:>11,.0f}")
print("="*60)
print("\n  Done!\n")

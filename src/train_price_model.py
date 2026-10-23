"""Train market price prediction model with chronological validation.

This script trains a scikit-learn model to predict the expected modal price
(INR per quintal for major commodities) given crop, year, and month.
It enforces strict temporal separation (training on 2010-2021, testing on 2022-2025)
to prevent target leakage and compares the model against simple historical baselines.
"""

from pathlib import Path
import json
import pandas as pd
import numpy as np
import joblib

from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_FILE = BASE_DIR / "data" / "processed" / "price_training_data.csv"
MODEL_DIR = BASE_DIR / "models"
MODEL_DIR.mkdir(parents=True, exist_ok=True)
MODEL_PATH = MODEL_DIR / "price_model.joblib"
METADATA_PATH = MODEL_DIR / "price_model_metadata.json"

print("=" * 65)
print("TRAINING MARKET PRICE PREDICTION MODEL")
print("=" * 65)

# 1. Load preprocessed data
df = pd.read_csv(DATA_FILE)
df["date"] = pd.to_datetime(df["date"])

# EXCLUDE SUGARCANE FROM PRICE MODEL TRAINING:
# Raw market price data contains severe unit mixing (Rs 7 to Rs 33,000) for Sugarcane,
# producing extreme historical prediction errors (139.5%). Sugarcane is excluded from
# price model training and evaluation until its source reporting units are verified.
df = df[df["commodity_name"] != "Sugarcane"].copy()

# 2. Define features and target
# STRICT TARGET LEAKAGE PREVENTION:
# We only use crop identity and calendar timing.
# We explicitly DO NOT include same-month minimum, maximum, or change columns,
# nor do we use future observations in the training set.
features = ["commodity_name", "year", "month_num"]
target = "avg_modal_price"

# 3. Chronological Train / Test Split
# Training: 2010-01 to 2021-12 (earliest ~80% of monthly time horizon)
# Testing:  2022-01 to 2025-03 (latest ~20% of monthly time horizon)
split_year = 2022
train_mask = df["year"] < split_year
test_mask = df["year"] >= split_year

train_df = df[train_mask].copy()
test_df = df[test_mask].copy()

X_train, y_train = train_df[features], train_df[target]
X_test, y_test = test_df[features], test_df[target]

print(f"Dataset split: Chronological at year {split_year}")
print(f"Training observations : {len(train_df):,} ({train_df['date'].min().strftime('%Y-%m')} to {train_df['date'].max().strftime('%Y-%m')})")
print(f"Testing observations  : {len(test_df):,} ({test_df['date'].min().strftime('%Y-%m')} to {test_df['date'].max().strftime('%Y-%m')})")

# 4. Simple Historical Baselines
# Baseline A: Crop Historical Mean
# Predicts each crop's historical average price from the training period.
crop_means = train_df.groupby("commodity_name")[target].mean().to_dict()
global_mean = train_df[target].mean()
test_pred_base_mean = test_df["commodity_name"].map(crop_means).fillna(global_mean)

mae_base_mean = mean_absolute_error(y_test, test_pred_base_mean)
rmse_base_mean = np.sqrt(mean_squared_error(y_test, test_pred_base_mean))
r2_base_mean = r2_score(y_test, test_pred_base_mean)

# Baseline B: Seasonal Crop-Month Mean
# Predicts each crop's historical average price for that specific calendar month.
crop_month_means = train_df.groupby(["commodity_name", "month_num"])[target].mean().to_dict()
test_pred_base_seasonal = [
    crop_month_means.get((row["commodity_name"], row["month_num"]), crop_means.get(row["commodity_name"], global_mean))
    for _, row in test_df.iterrows()
]
mae_base_seasonal = mean_absolute_error(y_test, test_pred_base_seasonal)
rmse_base_seasonal = np.sqrt(mean_squared_error(y_test, test_pred_base_seasonal))
r2_base_seasonal = r2_score(y_test, test_pred_base_seasonal)

# 5. Build and Train scikit-learn Pipeline
preprocessor = ColumnTransformer(
    transformers=[
        ("categorical", OneHotEncoder(handle_unknown="ignore"), ["commodity_name"]),
        ("numerical", "passthrough", ["year", "month_num"]),
    ]
)

model = Pipeline(
    steps=[
        ("preprocessor", preprocessor),
        (
            "regressor",
            RandomForestRegressor(
                n_estimators=100,
                random_state=42,
                n_jobs=-1,
                min_samples_leaf=2,
            ),
        ),
    ]
)

print("\nFitting Random Forest model on training records...")
model.fit(X_train, y_train)

# 6. Evaluate Model on Holdout Set
predictions = model.predict(X_test)
mae_model = mean_absolute_error(y_test, predictions)
rmse_model = np.sqrt(mean_squared_error(y_test, predictions))
r2_model = r2_score(y_test, predictions)

mae_impr_pct = ((mae_base_mean - mae_model) / mae_base_mean) * 100
rmse_impr_pct = ((rmse_base_mean - rmse_model) / rmse_base_mean) * 100

print("\n" + "=" * 65)
print("EVALUATION RESULTS (CHRONOLOGICAL HOLDOUT: 2022-2025)")
print("=" * 65)
print(f"{'Method':<32} | {'MAE':>10} | {'RMSE':>10} | {'R²':>7}")
print("-" * 65)
print(f"{'Baseline 1: Crop Historical Mean':<32} | {mae_base_mean:>10.2f} | {rmse_base_mean:>10.2f} | {r2_base_mean:>7.3f}")
print(f"{'Baseline 2: Seasonal Crop-Month':<32} | {mae_base_seasonal:>10.2f} | {rmse_base_seasonal:>10.2f} | {r2_base_seasonal:>7.3f}")
print(f"{'Random Forest Pipeline':<32} | {mae_model:>10.2f} | {rmse_model:>10.2f} | {r2_model:>7.3f}")
print("-" * 65)
print(f"MAE Improvement over Crop Mean   : {mae_impr_pct:+.1f}%")
print(f"RMSE Improvement over Crop Mean  : {rmse_impr_pct:+.1f}%")

# 7. Save Model and Metadata Artifacts
joblib.dump(model, MODEL_PATH)
print(f"\nTrained model artifact saved to: {MODEL_PATH}")

metadata = {
    "model_name": "crop_market_price_random_forest",
    "features": features,
    "target": target,
    "price_unit_notes": (
        "Reported values align standardly with INR per Quintal (100 kg) for major field crops "
        "(Maize, Wheat, Rice, Cotton, Groundnut, etc.) according to Agmarknet norms. "
        "Sugarcane has been strictly excluded from model training and evaluation due to unverified mixed units (Rs 7 to 33,000)."
    ),
    "sugarcane_status": "EXCLUDED from price-model training; price prediction returns None with unsupported_price_unit.",
    "split_year": split_year,
    "train_period": f"{train_df['date'].min().strftime('%Y-%m')} to {train_df['date'].max().strftime('%Y-%m')}",
    "test_period": f"{test_df['date'].min().strftime('%Y-%m')} to {test_df['date'].max().strftime('%Y-%m')}",
    "train_records": len(train_df),
    "test_records": len(test_df),
    "commodities": sorted(train_df["commodity_name"].unique().tolist()),
    "evaluation_metrics": {
        "crop_mean_baseline": {
            "mae": round(float(mae_base_mean), 2),
            "rmse": round(float(rmse_base_mean), 2),
            "r2": round(float(r2_base_mean), 3),
        },
        "seasonal_baseline": {
            "mae": round(float(mae_base_seasonal), 2),
            "rmse": round(float(rmse_base_seasonal), 2),
            "r2": round(float(r2_base_seasonal), 3),
        },
        "random_forest_model": {
            "mae": round(float(mae_model), 2),
            "rmse": round(float(rmse_model), 2),
            "r2": round(float(r2_model), 3),
            "mae_improvement_pct": round(float(mae_impr_pct), 1),
            "rmse_improvement_pct": round(float(rmse_impr_pct), 1),
        },
    },
}

with open(METADATA_PATH, "w") as f:
    json.dump(metadata, f, indent=2)
print(f"Model metadata saved to        : {METADATA_PATH}")

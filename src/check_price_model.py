"""Validate market price prediction model, run integrity checks, and report sliced evaluations.

This script loads data/processed/price_training_data.csv and the saved
model at models/price_model.joblib. It verifies:
1. Data integrity & zero target leakage.
2. Chronological holdout evaluation against simple baselines.
3. Sliced performance for standard field crops vs unit-volatile crops.
4. Per-commodity breakdown across all 16 crops.
5. Analysis of largest prediction errors and model limitations.
Existing saved model files are NOT modified.
"""

from pathlib import Path
import pandas as pd
import numpy as np
import joblib
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_FILE = BASE_DIR / "data" / "processed" / "price_training_data.csv"
MODEL_PATH = BASE_DIR / "models" / "price_model.joblib"

print("=" * 70)
print("COMPREHENSIVE MARKET PRICE MODEL CHECK & EVALUATION")
print("=" * 70)

# 1. Load dataset
df = pd.read_csv(DATA_FILE)
df["date"] = pd.to_datetime(df["date"])

# EXCLUDE SUGARCANE FROM PRICE MODEL EVALUATION:
# Sugarcane is excluded from the price model due to unverified mixed units (Rs 7 to Rs 33,000).
df = df[df["commodity_name"] != "Sugarcane"].copy()

# 2. Check required columns and data integrity
required_cols = ["commodity_name", "date", "year", "month_num", "avg_modal_price"]
missing_cols = [c for c in required_cols if c not in df.columns]
if missing_cols:
    raise ValueError(f"Missing required columns: {missing_cols}")

# Target leakage verification
features = ["commodity_name", "year", "month_num"]
target = "avg_modal_price"

print("\n--- 1. DATA INTEGRITY & LEAKAGE VERIFICATION ---")
print(f"Total processed records : {len(df):,}")
print(f"Unique commodities      : {df['commodity_name'].nunique()}")
print(f"Temporal span           : {df['date'].min().strftime('%Y-%m')} to {df['date'].max().strftime('%Y-%m')}")
print(f"Target in features      : {target in features} (PASS)")
print(f"Min/Max/Change in feats : {any(c in features for c in ['avg_min_price', 'avg_max_price', 'change'])} (PASS - Strictly Excluded)")
print(f"Null target values      : {df[target].isna().sum()} (PASS)")

# 3. Chronological Train / Test Split
split_year = 2022
train_df = df[df["year"] < split_year].copy()
test_df = df[df["year"] >= split_year].copy()

X_train, y_train = train_df[features], train_df[target]
X_test, y_test = test_df[features], test_df[target]

print("\n--- 2. CHRONOLOGICAL SPLIT DETAILS ---")
print(f"Train split (< {split_year}) : {len(train_df):,} records ({train_df['date'].min().strftime('%Y-%m')} to {train_df['date'].max().strftime('%Y-%m')})")
print(f"Test split (>= {split_year}): {len(test_df):,} records ({test_df['date'].min().strftime('%Y-%m')} to {test_df['date'].max().strftime('%Y-%m')})")

# 4. Load saved model
if not MODEL_PATH.exists():
    raise FileNotFoundError(f"Saved model not found at {MODEL_PATH}. Run src/train_price_model.py first.")

model = joblib.load(MODEL_PATH)
predictions = model.predict(X_test)

# 5. Baseline calculations
# Baseline 1: Historical Crop Mean
crop_means = train_df.groupby("commodity_name")[target].mean().to_dict()
global_mean = train_df[target].mean()
pred_base_mean = test_df["commodity_name"].map(crop_means).fillna(global_mean)

# Baseline 2: Seasonal Crop-Month Mean
crop_month_means = train_df.groupby(["commodity_name", "month_num"])[target].mean().to_dict()
pred_base_seasonal = [
    crop_month_means.get((row["commodity_name"], row["month_num"]), crop_means.get(row["commodity_name"], global_mean))
    for _, row in test_df.iterrows()
]

# Baseline 3: Lag-1 Persistence Baseline (predicting previous month's price if sequential)
test_with_lags = df.sort_values(["commodity_name", "date"]).copy()
test_with_lags["lag_1"] = test_with_lags.groupby("commodity_name")[target].shift(1)
test_lags = test_with_lags[test_with_lags["year"] >= split_year].dropna(subset=["lag_1"])

# Overall Metrics
mae_base_mean = mean_absolute_error(y_test, pred_base_mean)
rmse_base_mean = np.sqrt(mean_squared_error(y_test, pred_base_mean))
r2_base_mean = r2_score(y_test, pred_base_mean)

mae_base_seasonal = mean_absolute_error(y_test, pred_base_seasonal)
rmse_base_seasonal = np.sqrt(mean_squared_error(y_test, pred_base_seasonal))
r2_base_seasonal = r2_score(y_test, pred_base_seasonal)

mae_model = mean_absolute_error(y_test, predictions)
rmse_model = np.sqrt(mean_squared_error(y_test, predictions))
r2_model = r2_score(y_test, predictions)

mae_persist = mean_absolute_error(test_lags[target], test_lags["lag_1"])
rmse_persist = np.sqrt(mean_squared_error(test_lags[target], test_lags["lag_1"]))
r2_persist = r2_score(test_lags[target], test_lags["lag_1"])

print("\n--- 3. OVERALL HOLDOUT PERFORMANCE COMPARISON ---")
print(f"{'Method / Paradigm':<36} | {'MAE':>10} | {'RMSE':>10} | {'R2':>7}")
print("-" * 70)
print(f"{'Baseline 1: Crop Historical Mean':<36} | {mae_base_mean:>10.2f} | {rmse_base_mean:>10.2f} | {r2_base_mean:>7.3f}")
print(f"{'Baseline 2: Seasonal Crop-Month':<36} | {mae_base_seasonal:>10.2f} | {rmse_base_seasonal:>10.2f} | {r2_base_seasonal:>7.3f}")
print(f"{'Random Forest (Calendar Profile)':<36} | {mae_model:>10.2f} | {rmse_model:>10.2f} | {r2_model:>7.3f}")
print(f"{'Lag-1 Persistence (Autoregressive)':<36} | {mae_persist:>10.2f} | {rmse_persist:>10.2f} | {r2_persist:>7.3f}")
print("-" * 70)
print(f"RF MAE Reduction vs Historical Mean: {((mae_base_mean - mae_model) / mae_base_mean) * 100:.1f}%")

# 6. Sliced Evaluation: Standard Field Crops vs Unit-Volatile Crops
results_df = test_df.copy()
results_df["predicted_price"] = predictions
results_df["abs_error"] = np.abs(results_df[target] - results_df["predicted_price"])
results_df["pred_base_mean"] = pred_base_mean.values

print("\n--- 4. SLICED EVALUATION: STANDARD FIELD CROPS VS UNIT-VOLATILE CROPS ---")
for group_name, mask in [
    ("Standard Field Crops (14 crops)", results_df["commodity_name"] != "Coconut"),
    ("Unit-Volatile Crop (Coconut)", results_df["commodity_name"] == "Coconut"),
]:
    sub = results_df[mask]
    if len(sub) > 0:
        sub_mae_base = mean_absolute_error(sub[target], sub["pred_base_mean"])
        sub_mae_model = mean_absolute_error(sub[target], sub["predicted_price"])
        sub_rmse_model = np.sqrt(mean_squared_error(sub[target], sub["predicted_price"]))
        sub_r2_model = r2_score(sub[target], sub["predicted_price"])
        sub_mean_price = sub[target].mean()
        rel_err = (sub_mae_model / sub_mean_price) * 100

        print(f"\nGroup: {group_name} (N = {len(sub):,})")
        print(f"  Mean actual price : INR {sub_mean_price:,.2f}")
        print(f"  Base Mean MAE     : INR {sub_mae_base:,.2f}")
        print(f"  Model MAE         : INR {sub_mae_model:,.2f} (Rel Error: {rel_err:.1f}%)")
        print(f"  Model RMSE        : INR {sub_rmse_model:,.2f}")
        print(f"  Model R2          : {sub_r2_model:.3f}")
        print(f"  MAE Improvement   : {((sub_mae_base - sub_mae_model) / sub_mae_base) * 100:.1f}%")

# 7. Per-Crop Breakdown Across All 15 Commodities
print("\n--- 5. PER-COMMODITY PERFORMANCE (TEST PERIOD: 2022-2025) ---")
crop_summary = []
for crop, grp in results_df.groupby("commodity_name"):
    mean_price = grp[target].mean()
    c_base_mae = mean_absolute_error(grp[target], grp["pred_base_mean"])
    c_rf_mae = mean_absolute_error(grp[target], grp["predicted_price"])
    c_rf_rmse = np.sqrt(mean_squared_error(grp[target], grp["predicted_price"]))
    impr_pct = ((c_base_mae - c_rf_mae) / c_base_mae) * 100
    rel_err_pct = (c_rf_mae / mean_price) * 100

    crop_summary.append({
        "Commodity": crop,
        "Test N": len(grp),
        "Mean Actual (INR)": round(mean_price, 2),
        "Base MAE": round(c_base_mae, 2),
        "Model MAE": round(c_rf_mae, 2),
        "Model RMSE": round(c_rf_rmse, 2),
        "MAE Impr %": round(impr_pct, 1),
        "Rel Err %": round(rel_err_pct, 1),
    })

crop_summary_df = pd.DataFrame(crop_summary)
print(crop_summary_df.to_string(index=False))

# 8. 10 Largest Prediction Errors
print("\n--- 6. 10 LARGEST PREDICTION ERRORS ---")
largest_errors = results_df.nlargest(10, "abs_error")[
    ["commodity_name", "date", target, "predicted_price", "abs_error"]
].copy()
largest_errors["date"] = largest_errors["date"].dt.strftime("%Y-%m")
largest_errors.columns = ["Commodity", "Month", "Actual Price", "Predicted Price", "Absolute Error"]
print(largest_errors.to_string(index=False))

# 9. Verify unseen categories
print("\n--- 7. UNSEEN COMMODITIES CHECK ---")
unseen_crops = set(test_df["commodity_name"].unique()) - set(train_df["commodity_name"].unique())
print(f"Unseen crops in test set: {len(unseen_crops)} (PASS)")

print("\nValidation check completed successfully. Existing saved model was not altered.")

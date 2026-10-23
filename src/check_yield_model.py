import pandas as pd
import numpy as np

from pathlib import Path
from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

BASE_DIR = Path(__file__).resolve().parent.parent

data_file = BASE_DIR / "data" / "processed" / "yield_training_data.csv"

df = pd.read_csv(data_file)

# Check that required columns exist
required = [
    "District", "Crop", "Year", "Season",
    "Area", "Yield_tonnes_per_hectare"
]

missing = [col for col in required if col not in df.columns]

if missing:
    raise ValueError(f"Missing required columns: {missing}")

# Keep valid target and feature values
df = df.dropna(subset=required).copy()
df = df[df["Area"] > 0]
df = df[df["Yield_tonnes_per_hectare"] >= 0]

# Extract starting year from values such as 1997-98
df["Year_start"] = pd.to_numeric(
    df["Year"].astype(str).str.extract(r"(\d{4})")[0],
    errors="coerce"
)

df = df.dropna(subset=["Year_start"]).copy()
df["Year_start"] = df["Year_start"].astype(int)

# Features must not contain the target or its source columns
# Year_start is treated as a numerical feature to allow temporal continuity
features = ["District", "Crop", "Year_start", "Season", "Area"]
target = "Yield_tonnes_per_hectare"

print("DATA CHECK")
print("Rows available:", len(df))
print("Year range:", df["Year_start"].min(), "-", df["Year_start"].max())
print("Target in features:", target in features)
print("Production in features:", "Production" in features)
print("Yield in features:", "Yield" in features)

# Hold out the latest 20% of years
years = sorted(df["Year_start"].unique())

if len(years) < 3:
    raise ValueError("Not enough distinct years for a time-based test.")

split_index = int(len(years) * 0.8)
split_index = max(1, min(split_index, len(years) - 1))

test_years = years[split_index:]

train = df[df["Year_start"] < min(test_years)].copy()
test = df[df["Year_start"].isin(test_years)].copy()

X_train = train[features]
y_train = train[target]

X_test = test[features]
y_test = test[target]

categorical = ["District", "Crop", "Season"]
numerical = ["Year_start", "Area"]

preprocessor = ColumnTransformer([
    (
        "categorical",
        OneHotEncoder(handle_unknown="ignore"),
        categorical
    ),
    (
        "numerical",
        SimpleImputer(strategy="median"),
        numerical
    )
])

model = Pipeline([
    ("preprocessor", preprocessor),
    (
        "regressor",
        RandomForestRegressor(
            n_estimators=100,
            random_state=42,
            n_jobs=-1,
            min_samples_leaf=2
        )
    )
])

model.fit(X_train, y_train)
predictions = model.predict(X_test)

mae = mean_absolute_error(y_test, predictions)
rmse = np.sqrt(mean_squared_error(y_test, predictions))
r2 = r2_score(y_test, predictions)

print("\nTIME-BASED MODEL EVALUATION (OVERALL)")
print("-------------------------------------")
print("Training rows:", len(train))
print("Testing rows:", len(test))
print("Training years:", min(train["Year_start"]), "-", max(train["Year_start"]))
print("Testing years:", min(test["Year_start"]), "-", max(test["Year_start"]))
print(f"Overall MAE: {mae:.3f} tonnes/hectare")
print(f"Overall RMSE: {rmse:.3f} tonnes/hectare")
print(f"Overall R²: {r2:.3f}")

# Prepare detailed results dataframe for sliced evaluations
results = test[
    ["District", "Crop", "Year", "Year_start", "Season", "Area", target]
].copy()
results["Predicted_yield"] = predictions
results["Absolute_error"] = np.abs(
    results[target] - results["Predicted_yield"]
)

# Sliced metrics: Sugarcane vs Non-Sugarcane
print("\n" + "=" * 50)
print("SLICED EVALUATION: SUGARCANE VS NON-SUGARCANE CROPS")
print("=" * 50)

for label, mask in [
    ("Non-Sugarcane crops", results["Crop"] != "Sugarcane"),
    ("Sugarcane (high-biomass)", results["Crop"] == "Sugarcane"),
]:
    sub = results[mask]
    if len(sub) > 0:
        sub_actual = sub[target]
        sub_pred = sub["Predicted_yield"]
        sub_mae = mean_absolute_error(sub_actual, sub_pred)
        sub_rmse = np.sqrt(mean_squared_error(sub_actual, sub_pred))
        sub_r2 = r2_score(sub_actual, sub_pred)
        mean_yield = sub_actual.mean()
        rel_mae_pct = (sub_mae / mean_yield) * 100 if mean_yield > 0 else np.nan

        print(f"\n--- {label} (N = {len(sub):,}) ---")
        print(f"Mean actual yield : {mean_yield:.3f} tonnes/hectare")
        print(f"MAE               : {sub_mae:.3f} tonnes/hectare")
        print(f"Relative MAE      : {rel_mae_pct:.1f}% of mean yield")
        print(f"RMSE              : {sub_rmse:.3f} tonnes/hectare")
        print(f"R² score          : {sub_r2:.3f}")

# Sliced metrics for top crops by frequency
print("\n" + "=" * 50)
print("PER-CROP PERFORMANCE FOR TOP 10 MOST FREQUENT CROPS")
print("=" * 50)
top_crops = results["Crop"].value_counts().head(10).index
crop_metrics = []
for crop_name in top_crops:
    sub = results[results["Crop"] == crop_name]
    sub_actual = sub[target]
    sub_pred = sub["Predicted_yield"]
    sub_mae = mean_absolute_error(sub_actual, sub_pred)
    sub_rmse = np.sqrt(mean_squared_error(sub_actual, sub_pred))
    mean_act = sub_actual.mean()
    rel_mae_pct = (sub_mae / mean_act) * 100 if mean_act > 0 else np.nan
    crop_metrics.append({
        "Crop": crop_name,
        "Test Records": len(sub),
        "Mean Actual (t/ha)": round(mean_act, 2),
        "MAE (t/ha)": round(sub_mae, 3),
        "RMSE (t/ha)": round(sub_rmse, 3),
        "Rel Error (%)": round(rel_mae_pct, 1)
    })

print(pd.DataFrame(crop_metrics).to_string(index=False))

# Examine the largest prediction errors
print("\n" + "=" * 50)
print("10 LARGEST PREDICTION ERRORS")
print("=" * 50)
print(
    results.nlargest(10, "Absolute_error")[
        ["District", "Crop", "Year", "Season", "Area", target, "Predicted_yield", "Absolute_error"]
    ].to_string(index=False)
)

print("\n" + "=" * 50)
print("UNSEEN VALUES IN TEST SET")
print("=" * 50)
for col in ["Crop", "District", "Season"]:
    unseen = set(test[col].unique()) - set(train[col].unique())
    print(f"{col}: {len(unseen)} unseen values")
    if unseen:
        print(sorted(unseen))

print("\nCheck complete. Existing saved model was not changed.")
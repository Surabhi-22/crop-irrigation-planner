
import pandas as pd
import numpy as np
import joblib

from pathlib import Path
from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

BASE_DIR = Path(__file__).resolve().parent.parent

data_file = BASE_DIR / "data" / "processed" / "yield_training_data.csv"
model_dir = BASE_DIR / "models"
model_dir.mkdir(parents=True, exist_ok=True)

df = pd.read_csv(data_file)

# Features and target
# Year_start is treated as a numerical feature to allow temporal continuity
features = ["District", "Crop", "Year_start", "Season", "Area"]
target = "Yield_tonnes_per_hectare"

# Separate numerical and categorical columns
categorical = ["District", "Crop", "Season"]
numerical = ["Year_start", "Area"]

preprocessor = ColumnTransformer([
    ("categorical",
     OneHotEncoder(handle_unknown="ignore"),
     categorical),
    ("numerical",
     SimpleImputer(strategy="median"),
     numerical)
])

model = Pipeline([
    ("preprocessor", preprocessor),
    ("regressor", RandomForestRegressor(
        n_estimators=100,
        random_state=42,
        n_jobs=-1,
        min_samples_leaf=2
    ))
])

# Hold out the latest 20% of years for clean, zero-leakage evaluation
years = sorted(df["Year_start"].unique())
split_index = int(len(years) * 0.8)
split_index = max(1, min(split_index, len(years) - 1))
test_years = years[split_index:]

train = df[df["Year_start"] < min(test_years)].copy()
test = df[df["Year_start"].isin(test_years)].copy()

X_train, y_train = train[features], train[target]
X_test, y_test = test[features], test[target]

# Fit model on training years (< 2015)
model.fit(X_train, y_train)
predictions = model.predict(X_test)

mae = mean_absolute_error(y_test, predictions)
rmse = np.sqrt(mean_squared_error(y_test, predictions))
r2 = r2_score(y_test, predictions)

print("MODEL EVALUATION (TEMPORAL HOLDOUT: 2015-2019)")
print("---------------------------------------------")
print(f"Training records : {len(X_train)} (years {min(train['Year_start'])}-{max(train['Year_start'])})")
print(f"Testing records  : {len(X_test)} (years {min(test['Year_start'])}-{max(test['Year_start'])})")
print(f"Holdout MAE      : {mae:.3f} tonnes/hectare")
print(f"Holdout RMSE     : {rmse:.3f} tonnes/hectare")
print(f"Holdout R² score : {r2:.3f}")

model_path = model_dir / "yield_model.joblib"
joblib.dump(model, model_path)

print(f"\nModel saved to: {model_path}")


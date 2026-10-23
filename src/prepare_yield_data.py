
import pandas as pd
from pathlib import Path

# Project paths
BASE_DIR = Path(__file__).resolve().parent.parent

input_file = (
    BASE_DIR
    / "data"
    / "processed"
    / "karnataka_crop_production_clean.csv"
)

output_file = (
    BASE_DIR
    / "data"
    / "processed"
    / "yield_training_data.csv"
)

# Load cleaned crop production data
df = pd.read_csv(input_file)

print("Original dataset shape:", df.shape)

# Keep comparable units
df = df[
    (df["Area Units"].str.strip().str.lower() == "hectare")
    & (df["Production Units"].str.strip().str.lower() == "tonnes")
].copy()

# Convert required columns to numeric
for col in ["Area", "Yield_tonnes_per_hectare"]:
    df[col] = pd.to_numeric(df[col], errors="coerce")

# Remove invalid area and missing target values
df = df[
    (df["Area"] > 0)
    & (df["Yield_tonnes_per_hectare"].notna())
].copy()

# Canonical mapping for Karnataka districts to unify pre- and post-2014 nomenclature
DISTRICT_MAPPING = {
    "BAGALKOT": "BAGALKOTE",
    "BELLARY": "BALLARI",
    "BELGAUM": "BELAGAVI",
    "CHAMARAJANAGAR": "CHAMARAJANAGARA",
    "CHIKBALLAPUR": "CHIKKABALLAPURA",
    "CHIKMAGALUR": "CHIKKAMAGALURU",
    "DAKSHIN KANNAD": "DAKSHINA KANNADA",
    "GULBARGA": "KALABURAGI",
    "MYSORE": "MYSURU",
    "SHIMOGA": "SHIVAMOGGA",
    "TUMKUR": "TUMAKURU",
    "UTTAR KANNAD": "UTTARA KANNADA",
    "BIJAPUR": "VIJAYAPURA",
    "YADGIR": "YADAGIRI",
}

# Standardize text fields and canonicalize district names
for text_col in ["District", "Crop", "Season", "Year"]:
    if text_col in df.columns:
        df[text_col] = df[text_col].astype(str).str.strip()

df["District"] = (
    df["District"]
    .str.upper()
    .replace(DISTRICT_MAPPING)
)

# Extract numeric starting year from format such as '1997-98'
df["Year_start"] = pd.to_numeric(
    df["Year"].str.extract(r"(\d{4})")[0],
    errors="coerce"
)
df = df.dropna(subset=["Year_start"]).copy()
df["Year_start"] = df["Year_start"].astype(int)

# Exclude flagged zero-yield records for the initial baseline
df = df[
    (df["Needs_zero_value_review"] == 0)
    & (df["Yield_tonnes_per_hectare"] > 0)
].copy()

# Keep required model columns, including both original Year and numeric Year_start
features = [
    "District",
    "Crop",
    "Year",
    "Year_start",
    "Season",
    "Area",
    "Yield_tonnes_per_hectare",
]

df = df[features].copy()

# Save the training dataset
df.to_csv(output_file, index=False)

print("\nPrepared dataset shape:", df.shape)
print("Unique canonical districts:", df["District"].nunique())
print("Year range:", df["Year_start"].min(), "to", df["Year_start"].max())
print("\nMissing values:")
print(df.isna().sum())
print("\nYield summary:")
print(df["Yield_tonnes_per_hectare"].describe())
print("\nSaved to:", output_file)

"""Prepare crop price training dataset from raw market price observations.

This script reads data/raw/crop_price_dataset.csv without modifying it,
audits and cleans records transparently, extracts temporal features,
and writes the processed dataset for model training and evaluation.
"""

from pathlib import Path
import pandas as pd
import numpy as np

# Define paths
BASE_DIR = Path(__file__).resolve().parent.parent
RAW_FILE = BASE_DIR / "data" / "raw" / "crop_price_dataset.csv"
OUTPUT_FILE = BASE_DIR / "data" / "processed" / "price_training_data.csv"
REVIEW_FILE = BASE_DIR / "data" / "processed" / "price_data_reviewed.csv"

# Ensure output directory exists
OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

print("=" * 60)
print("STEP 2: PREPARING MARKET PRICE DATA")
print("=" * 60)

# 1. Load raw dataset
df = pd.read_csv(RAW_FILE)
original_rows = len(df)
print(f"Loaded raw records: {original_rows:,}")

# 2. Parse date column
df["date"] = pd.to_datetime(df["month"], errors="coerce")
invalid_dates = df["date"].isna().sum()
if invalid_dates > 0:
    print(f"Warning: Found {invalid_dates} invalid dates.")

# Extract temporal features
df["year"] = df["date"].dt.year
df["month_num"] = df["date"].dt.month
df["quarter"] = df["date"].dt.quarter

# 3. Numeric conversion for price columns
price_cols = ["avg_modal_price", "avg_min_price", "avg_max_price"]
for col in price_cols:
    df[col] = pd.to_numeric(df[col], errors="coerce")

# 4. Standardize text columns
df["commodity_name"] = df["commodity_name"].astype(str).str.strip()

# 5. Transparent Quality Audits & Flags
# Flag mathematically inconsistent price boundaries:
# In valid auction data: min <= modal <= max and min <= max
df["flag_min_gt_max"] = df["avg_min_price"] > df["avg_max_price"]
df["flag_modal_gt_max"] = df["avg_modal_price"] > df["avg_max_price"]
df["flag_min_gt_modal"] = df["avg_min_price"] > df["avg_modal_price"]
df["flag_non_positive_price"] = (df[price_cols] <= 0).any(axis=1)

# Flag extreme price values / corrupt entries (e.g. min price > 100,000)
df["flag_extreme_outlier"] = df[price_cols].max(axis=1) > 100000

# Flag known unit volatility crops (Coconut, Sugarcane) where mandi reporting units shift
df["is_unit_volatile_crop"] = df["commodity_name"].isin(["Coconut", "Sugarcane"])

# Combine invalidity flags
df["is_invalid_record"] = (
    df["flag_min_gt_max"]
    | df["flag_modal_gt_max"]
    | df["flag_min_gt_modal"]
    | df["flag_non_positive_price"]
    | df["flag_extreme_outlier"]
    | df["date"].isna()
    | df["avg_modal_price"].isna()
)

# 6. Save a full review copy with all flags for transparency
df.to_csv(REVIEW_FILE, index=False)
print(f"Saved review copy with quality flags to: {REVIEW_FILE}")

# 7. Filter clean dataset
# Only keep valid, non-corrupt price observations
clean_df = df[~df["is_invalid_record"]].copy()

# Sort chronologically by commodity and date
clean_df = clean_df.sort_values(["commodity_name", "date"]).reset_index(drop=True)

# Remove exact duplicates if any
clean_df = clean_df.drop_duplicates(subset=["commodity_name", "date", "avg_modal_price"])

# 8. Select clean training columns
# Note: Same-month avg_min_price, avg_max_price, and change are NOT included as features
# because using them would constitute direct target leakage during inference.
training_columns = [
    "commodity_name",
    "date",
    "year",
    "month_num",
    "quarter",
    "avg_modal_price",
    "is_unit_volatile_crop"
]

clean_training_df = clean_df[training_columns].copy()
clean_training_df.to_csv(OUTPUT_FILE, index=False)

print("\nPREPROCESSING SUMMARY:")
print(f"Raw records           : {original_rows:,}")
print(f"Inconsistent/corrupt  : {df['is_invalid_record'].sum():,} rows removed")
print(f"Clean training records: {len(clean_training_df):,}")
print(f"Unique commodities    : {clean_training_df['commodity_name'].nunique()}")
print(f"Date range            : {clean_training_df['date'].min().strftime('%Y-%m')} to {clean_training_df['date'].max().strftime('%Y-%m')}")
print(f"Clean data saved to   : {OUTPUT_FILE}")

import pandas as pd
from pathlib import Path

# File paths
input_file = Path("data/raw/crop_price_dataset.csv")
output_file = Path("data/processed/crop_prices_clean.csv")
review_file = Path("data/processed/crop_prices_reviewed.csv")

# Load original dataset
df = pd.read_csv(input_file)

print("Original rows:", len(df))

# Convert month into a date
df["month"] = pd.to_datetime(df["month"], errors="coerce")

# Convert price columns into numeric values
price_columns = [
    "avg_modal_price",
    "avg_min_price",
    "avg_max_price"
]

for col in price_columns:
    df[col] = pd.to_numeric(df[col], errors="coerce")

# Flag records requiring investigation
df["Invalid_price_range"] = (
    df["avg_min_price"] > df["avg_max_price"]
)

df["Unusually_large_price"] = (
    df[price_columns].max(axis=1) > 100000
)

df["Missing_change"] = df["change"].isna()

# Save the review copy with flags
review_file.parent.mkdir(parents=True, exist_ok=True)
df.to_csv(review_file, index=False)

# Clean a separate copy
clean_df = df.copy()

# Remove rows with invalid dates or missing essential fields
clean_df = clean_df.dropna(
    subset=["month", "commodity_name", "avg_modal_price",
            "avg_min_price", "avg_max_price"]
)

# Remove impossible or inconsistent price records
clean_df = clean_df[
    (clean_df[price_columns] >= 0).all(axis=1)
    & (~clean_df["Invalid_price_range"])
    & (~clean_df["Unusually_large_price"])
].copy()

# Remove exact duplicate records
clean_df = clean_df.drop_duplicates()

# Keep missing 'change' values as missing;
# they are not essential for price-based recommendations.
clean_df.to_csv(output_file, index=False)

print("\nPRICE CLEANING COMPLETED")
print("Original rows:", len(df))
print("Cleaned rows:", len(clean_df))
print("Rows removed:", len(df) - len(clean_df))
print("Missing change values retained:", clean_df["change"].isna().sum())
print("Clean dataset saved to:", output_file)
print("Review copy saved to:", review_file)


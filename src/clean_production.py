
from pathlib import Path
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent
RAW_FILE = (
    PROJECT_ROOT
    / "data"
    / "raw"
    / "India Agriculture Crop Production.csv"
    / "India Agriculture Crop Production.csv"
)
OUTPUT_DIR = PROJECT_ROOT / "data" / "processed"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Load the original dataset
df = pd.read_csv(RAW_FILE, low_memory=False)

# Select Karnataka records
karnataka = df[
    df["State"].astype(str).str.strip().str.casefold()
    == "karnataka"
].copy()

# Keep records with production in tonnes and valid area
clean = karnataka[
    (karnataka["Production Units"].astype(str).str.strip() == "Tonnes")
    & karnataka["Production"].notna()
    & karnataka["Area"].notna()
    & (karnataka["Area"] > 0)
].copy()

# Calculate yield from production and area
clean["Yield_tonnes_per_hectare"] = (
    clean["Production"] / clean["Area"]
)

# Flag zero values for review rather than deleting them
clean["Needs_zero_value_review"] = (
    (clean["Production"] == 0)
    | (clean["Yield_tonnes_per_hectare"] == 0)
)
clean["High_Yield_Review"]=(clean["Yield_tonnes_per_hectare"] > 100)
# Save to processed folder
output_file = OUTPUT_DIR / "karnataka_crop_production_clean.csv"
clean.to_csv(output_file, index=False)

print("Original Karnataka rows:", len(karnataka))
print("Cleaned rows:", len(clean))
print("Rows flagged for zero-value review:",
      clean["Needs_zero_value_review"].sum())
print("Saved to:", output_file)
print("\nYield summary:")
print(clean["Yield_tonnes_per_hectare"].describe())

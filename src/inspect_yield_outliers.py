
import pandas as pd
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

file_path = (
    BASE_DIR
    / "data"
    / "processed"
    / "karnataka_crop_production_clean.csv"
)

df = pd.read_csv(file_path)

# Keep only records with comparable production units
df = df[
    df["Production Units"].astype(str).str.strip().str.lower().eq("tonnes")
].copy()

df["Yield_tonnes_per_hectare"] = pd.to_numeric(
    df["Yield_tonnes_per_hectare"], errors="coerce"
)

df = df.dropna(subset=["Yield_tonnes_per_hectare"])

print("Top 20 highest yield records:")
print(
    df.nlargest(20, "Yield_tonnes_per_hectare")[
        [
            "District",
            "Crop",
            "Year",
            "Season",
            "Area",
            "Production",
            "Yield_tonnes_per_hectare",
        ]
    ].to_string(index=False)
)

print("\nCrops with yield above 20 tonnes/hectare:")
high_yield = df[df["Yield_tonnes_per_hectare"] > 20]

print(
    high_yield.groupby("Crop")["Yield_tonnes_per_hectare"]
    .agg(["count", "min", "median", "max"])
    .sort_values("count", ascending=False)
    .to_string()
)

print("\nYield percentiles:")
print(
    df["Yield_tonnes_per_hectare"]
    .quantile([0.50, 0.75, 0.90, 0.95, 0.99, 1.00])
)

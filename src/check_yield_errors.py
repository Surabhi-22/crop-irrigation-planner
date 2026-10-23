import pandas as pd
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

file_path = (
    BASE_DIR / "data" / "processed"
    / "karnataka_crop_production_clean.csv"
)

df = pd.read_csv(file_path)

df = df[
    df["Production Units"].astype(str).str.strip().str.lower().eq("tonnes")
].copy()

df["Year_start"] = (
    df["Year"].astype(str).str.extract(r"(\d{4})")[0]
)

df["Year_start"] = pd.to_numeric(
    df["Year_start"], errors="coerce"
)

df["Yield_tonnes_per_hectare"] = pd.to_numeric(
    df["Yield_tonnes_per_hectare"], errors="coerce"
)

df = df.dropna(
    subset=["Year_start", "Yield_tonnes_per_hectare"]
)

test = df[df["Year_start"] >= 2015]

print("TIME-BASED TEST DATA SUMMARY")
print("Test records:", len(test))
print("Years:", int(test["Year_start"].min()),
      "to", int(test["Year_start"].max()))

print("\nYIELD DISTRIBUTION IN TEST DATA")
print(
    test["Yield_tonnes_per_hectare"].describe(
        percentiles=[0.50, 0.90, 0.95, 0.99]
    )
)

print("\nTOP CROPS BY MEDIAN YIELD")
print(
    test.groupby("Crop")["Yield_tonnes_per_hectare"]
    .agg(["count", "median", "max"])
    .sort_values("median", ascending=False)
    .head(10)
    .to_string()
)

print("\nRecords above 20 tonnes/hectare:")
print(
    test[test["Yield_tonnes_per_hectare"] > 20]
    .groupby("Crop")
    .size()
    .sort_values(ascending=False)
    .to_string()
)
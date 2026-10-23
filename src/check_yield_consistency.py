
import pandas as pd
import numpy as np
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

file_path = (
    BASE_DIR / "data" / "processed"
    / "karnataka_crop_production_clean.csv"
)

df = pd.read_csv(file_path)

# Focus on records with comparable units
df = df[
    df["Area Units"].astype(str).str.strip().str.lower().eq("hectare")
    & df["Production Units"].astype(str).str.strip().str.lower().eq("tonnes")
].copy()

for col in ["Area", "Production", "Yield_tonnes_per_hectare"]:
    df[col] = pd.to_numeric(df[col], errors="coerce")

df = df.dropna(
    subset=["Area", "Production", "Yield_tonnes_per_hectare"]
)
df = df[df["Area"] > 0]

# Recalculate yield independently
df["calculated_yield"] = df["Production"] / df["Area"]

df["absolute_difference"] = (
    df["Yield_tonnes_per_hectare"] - df["calculated_yield"]
).abs()

print("Records checked:", len(df))
print(
    "Records with yield difference > 0.1 tonnes/ha:",
    (df["absolute_difference"] > 0.1).sum()
)

print("\nLargest yield discrepancies:")
print(
    df.nlargest(10, "absolute_difference")[
        [
            "District", "Crop", "Year", "Area", "Production",
            "Yield_tonnes_per_hectare", "calculated_yield",
            "absolute_difference"
        ]
    ].to_string(index=False)
)

print("\nYield summary by crop (crops with at least 30 records):")
summary = df.groupby("Crop")["Yield_tonnes_per_hectare"].agg(
    ["count", "median", "min", "max"]
)

print(
    summary[summary["count"] >= 30]
    .sort_values("median", ascending=False)
    .to_string()
)

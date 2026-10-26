
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent

file_path = (
    ROOT
    / "data"
    / "processed"
    / "karnataka_crop_production_clean.csv"
)

df = pd.read_csv(file_path)

print("Rows and columns:", df.shape)
print("\nColumns:")
print(df.columns.tolist())

print("\nCrop count:")
print(df["Crop"].nunique())

print("\nTop 10 crops by number of records:")
print(df["Crop"].value_counts().head(10))

print("\nYear range:")
print(df["Year"].min(), "to", df["Year"].max())

print("\nMissing values:")
print(df.isnull().sum())

print("\nZero-yield records:")
print((df["Yield_tonnes_per_hectare"] == 0).sum())

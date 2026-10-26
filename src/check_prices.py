import pandas as pd
from pathlib import Path

file = Path("data/processed/crop_prices_reviewed.csv")

df = pd.read_csv(file)

print("Shape:", df.shape)
print("\nColumns:")
print(df.columns.tolist())

print("\nFirst 5 rows:")
print(df.head().to_string())

print("\nMissing values:")
print(df.isna().sum())

print("\nData types:")
print(df.dtypes)


import pandas as pd

file_path = "data/processed/karnataka_crop_production_clean.csv"

df = pd.read_csv(file_path)

print("Dataset shape:", df.shape)
print("\nProduction units:")
print(df["Production Units"].value_counts(dropna=False))

print("\nArea units:")
print(df["Area Units"].value_counts(dropna=False))

# Check whether all production records use tonnes
units = df["Production Units"].astype("string").str.strip().str.lower()
non_tonnes = df[units != "tonnes"]

print("\nNon-tonne records:", len(non_tonnes))

if len(non_tonnes) == 0:
    print("SUCCESS: All records use tonnes.")
else:
    print("WARNING: Review these records before model training.")
    print(non_tonnes[
        ["District", "Crop", "Production", "Production Units"]
    ].head(10).to_string(index=False))

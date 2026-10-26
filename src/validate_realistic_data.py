
import pandas as pd

file_path = "data/raw/indian_agriculture_realistic_dataset.csv"
df = pd.read_csv(file_path)

print("--- DATASET SUMMARY ---")
print("Shape:", df.shape)
print("Exact duplicate rows:", df.duplicated().sum())

print("\n--- MISSING VALUES ---")
print(df.isnull().sum()[df.isnull().sum() > 0])

print("\n--- NUMERIC SUMMARY ---")
print(df.describe().T.to_string())

print("\n--- LOGICAL CHECKS ---")

checks = {
    "Invalid month": ~df["Month"].between(1, 12),
    "Negative farm size": df["Farm_Size_ha"] < 0,
    "Soil pH outside 0-14": ~df["Soil_pH"].between(0, 14),
    "Negative rainfall": df["Rainfall_mm"] < 0,
    "Negative irrigation": df["Irrigation_Applied_mm"] < 0,
    "Negative yield": df["Yield_tonnes_ha"] < 0,
    "Negative total cost": df["Total_Cost_Rs"] < 0,
    "Negative revenue": df["Revenue_Rs"] < 0,
}

for name, condition in checks.items():
    print(f"{name}: {condition.fillna(False).sum()} rows")

print("\n--- PROFIT CONSISTENCY ---")
expected_profit = df["Revenue_Rs"] - df["Total_Cost_Rs"]
difference = (df["Profit_Rs"] - expected_profit).abs()

print("Rows where profit differs from revenue - cost:",
      (difference > 1).sum())

print("\n--- CATEGORICAL VALUES ---")
for column in ["State", "Crop", "Crop_Season",
               "Soil_Type", "Irrigation_Type"]:
    print(f"\n{column}:")
    print(df[column].value_counts().head(15).to_string())



print("\n--- POSSIBLE REPEATED HEADER ROWS ---")

header_checks = {
    "State": "State",
    "District": "District",
    "Crop": "Crop",
    "Crop_Season": "Crop_Season",
    "Soil_Type": "Soil_Type",
    "Irrigation_Type": "Irrigation_Type",
}

for column, header_value in header_checks.items():
    count = (
        df[column].astype("string").str.strip()
        .eq(header_value).sum()
    )
    print(f"{column} equals its header name: {count}")

print("\n--- PROFIT MISMATCH EXAMPLES ---")

expected_profit = df["Revenue_Rs"] - df["Total_Cost_Rs"]
difference = (df["Profit_Rs"] - expected_profit).abs()

mismatch_rows = df.loc[
    difference > 1,
    [
        "Farm_ID", "Crop", "Revenue_Rs",
        "Total_Cost_Rs", "Profit_Rs"
    ]
].copy()

mismatch_rows["Absolute_Difference"] = difference[difference > 1]

print("Total mismatches:", len(mismatch_rows))
print(mismatch_rows.head(10).to_string(index=False))

print("\n--- YEAR AND LOCATION SUMMARY ---")
print("Years:", sorted(df["Year"].dropna().unique()))
print("Number of states:", df["State"].nunique())
print("Number of districts:", df["District"].nunique())

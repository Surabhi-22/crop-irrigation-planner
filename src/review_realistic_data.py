import pandas as pd
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

source = BASE_DIR / "data" / "raw" / "indian_agriculture_realistic_dataset.csv"
destination = BASE_DIR / "data" / "processed" / "realistic_agriculture_clean.csv"

df = pd.read_csv(source)

print("Original rows:", len(df))

# 1. Handle missing categorical values without guessing.
for col in ["Drought_Stress", "Government_Support"]:
    # Treat empty strings and whitespace as missing too.
    df[col] = df[col].replace(r"^\s*$", pd.NA, regex=True)

    # Preserve which records originally had missing values.
    df[f"Missing_{col}"] = df[col].isna()

    # Use Unknown rather than inventing a value.
    df[col] = df[col].fillna("Unknown")

# 2. Preserve the original profit for auditing.
df["Profit_Rs_Original"] = pd.to_numeric(
    df["Profit_Rs"], errors="coerce"
)

revenue = pd.to_numeric(df["Revenue_Rs"], errors="coerce")
cost = pd.to_numeric(df["Total_Cost_Rs"], errors="coerce")

# 3. Calculate the profit implied by revenue and cost.
df["Profit_Rs_Calculated"] = revenue - cost

# Flag mismatches before correcting the main profit column.
df["Profit_Mismatch"] = (
    df["Profit_Rs_Original"].notna()
    & df["Profit_Rs_Calculated"].notna()
    & (
        (df["Profit_Rs_Original"] - df["Profit_Rs_Calculated"])
        .abs() > 1
    )
)

# Replace Profit_Rs only when both inputs are available.
valid_inputs = revenue.notna() & cost.notna()
df.loc[valid_inputs, "Profit_Rs"] = df.loc[
    valid_inputs, "Profit_Rs_Calculated"
]

# 4. Save as a new file; never overwrite the raw dataset.
destination.parent.mkdir(parents=True, exist_ok=True)
df.to_csv(destination, index=False)

print("\nCLEANING COMPLETED")
print("Rows saved:", len(df))
print("Missing drought values originally:", df["Missing_Drought_Stress"].sum())
print("Missing government support originally:", df["Missing_Government_Support"].sum())
print("Profit mismatches flagged:", df["Profit_Mismatch"].sum())
print("Rows with unavailable profit inputs:", (~valid_inputs).sum())
print("Missing values remaining in key columns:")
print(df[["Drought_Stress", "Government_Support", "Profit_Rs"]].isna().sum())
print("\nSaved to:", destination)
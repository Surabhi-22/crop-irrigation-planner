
from pathlib import Path
import pandas as pd

project_root = Path(__file__).resolve().parent.parent

csv_path = (
    project_root
    / "data"
    / "raw"
    / "India Agriculture Crop Production.csv"
    / "India Agriculture Crop Production.csv"
)

df = pd.read_csv(csv_path, low_memory=False)

# Remove accidental spaces from column names and text fields
df.columns = df.columns.str.strip()
for col in ["State", "District", "Crop", "Season"]:
    df[col] = df[col].astype("string").str.strip()

print("\n--- DATASET OVERVIEW ---")
print("Total rows:", len(df))
print("Year range:", df["Year"].min(), "to", df["Year"].max())
print("Number of states/UTs:", df["State"].nunique())
print("Number of districts:", df["District"].nunique())
print("Number of crops:", df["Crop"].nunique())
print("Seasons:", df["Season"].dropna().unique().tolist())

print("\n--- KARNATAKA COVERAGE ---")
karnataka = df[
    df["State"].str.casefold().eq("karnataka").fillna(False)
]

print("Karnataka rows:", len(karnataka))
print("Karnataka districts:", karnataka["District"].nunique())
print("Karnataka crops:", karnataka["Crop"].nunique())
print("Karnataka year range:")
print(karnataka["Year"].min(), "to", karnataka["Year"].max())

print("\nTop 10 crops in Karnataka:")
print(karnataka["Crop"].value_counts().head(10))

print("\n--- PRODUCTION UNITS ---")
print(df["Production Units"].value_counts(dropna=False))

print("\n--- MISSING VALUES ---")
print(df.isnull().sum())

print("\n--- DUPLICATE ROWS ---")
print("Exact duplicate rows:", df.duplicated().sum())



print("\n--- KARNATAKA: AREA UNITS ---")
print(karnataka["Area Units"].value_counts(dropna=False))

print("\n--- KARNATAKA: PRODUCTION UNITS ---")
print(karnataka["Production Units"].value_counts(dropna=False))

print("\n--- KARNATAKA: MISSING VALUES ---")
print(karnataka.isnull().sum())

print("\n--- KARNATAKA: YIELD SUMMARY ---")
print(karnataka["Yield"].describe())

print("\n--- KARNATAKA: MISSING PRODUCTION BY UNIT ---")
print(
    karnataka.groupby("Production Units", dropna=False)["Production"]
    .agg(total_rows="size", missing_values="count")
)
print("\n--- KARNATAKA: PRODUCTION COMPLETENESS ---")
print(
    karnataka.groupby("Production Units", dropna=False)["Production"]
    .agg(
        total_rows="size",
        available_values="count",
    )
    .assign(
        missing_values=lambda x: x["total_rows"] - x["available_values"]
    )
)




# Keep only Karnataka records with production measured in tonnes
tonnes = karnataka[
    (karnataka["Production Units"] == "Tonnes")
    & karnataka["Production"].notna()
    & (karnataka["Area"] > 0)
].copy()

# Calculate yield independently from production and area
tonnes["Calculated_Yield"] = (
    tonnes["Production"] / tonnes["Area"]
)

print("\n--- 10 HIGHEST EXISTING YIELD VALUES ---")
print(
    tonnes.nlargest(10, "Yield")[
        [
            "District", "Crop", "Year", "Season",
            "Area", "Production", "Production Units",
            "Yield", "Calculated_Yield"
        ]
    ].to_string(index=False)
)

print("\n--- EXISTING VS CALCULATED YIELD ---")
print(
    tonnes[["Yield", "Calculated_Yield"]].describe()
)

print("\n--- ZERO OR NEGATIVE VALUES ---")
print("Zero yield:", (tonnes["Yield"] == 0).sum())
print("Negative yield:", (tonnes["Yield"] < 0).sum())
print("Zero production:", (tonnes["Production"] == 0).sum())

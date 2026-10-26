
import pandas as pd

file_path = "data/raw/crop_price_dataset.csv"
df = pd.read_csv(file_path)

# Convert month into a date
df["month"] = pd.to_datetime(df["month"], errors="coerce")

print("\n--- BASIC SUMMARY ---")
print("Shape:", df.shape)
print("Date range:", df["month"].min(), "to", df["month"].max())
print("Unique crops:", df["commodity_name"].nunique())
print("Unique states:", df["state_name"].nunique())
print("Unique districts:", df["district_name"].nunique())

print("\n--- CROPS ---")
print(sorted(df["commodity_name"].dropna().unique()))

print("\n--- STATES ---")
print(sorted(df["state_name"].dropna().unique()))

print("\n--- DISTRICTS (first 20) ---")
print(sorted(df["district_name"].dropna().unique())[:20])

print("\n--- PRICE SUMMARY ---")
price_columns = [
    "avg_modal_price",
    "avg_min_price",
    "avg_max_price"
]
print(df[price_columns].describe())

print("\n--- INVALID PRICE CHECKS ---")
print("Prices <= 0:")
print((df[price_columns] <= 0).sum())

print("\nMinimum price greater than maximum price:")
print((df["avg_min_price"] > df["avg_max_price"]).sum())

print("\n--- DUPLICATES ---")
print("Exact duplicate rows:", df.duplicated().sum())

print("\n--- MISSING VALUES ---")
print(df.isnull().sum())




print("\n--- ROWS WITH MIN PRICE > MAX PRICE ---")
print(
    df.loc[
        df["avg_min_price"] > df["avg_max_price"],
        ["month", "commodity_name", "avg_min_price",
         "avg_modal_price", "avg_max_price"]
    ].to_string(index=False)
)

print("\n--- 10 HIGHEST MAXIMUM PRICES ---")
print(
    df.nlargest(10, "avg_max_price")[
        ["month", "commodity_name", "avg_min_price",
         "avg_modal_price", "avg_max_price"]
    ].to_string(index=False)
)

print("\n--- ROWS WITH MISSING CHANGE VALUES ---")
print(
    df[df["change"].isna()][
        ["month", "commodity_name", "avg_modal_price",
         "calculationType", "change"]
    ].to_string(index=False)
)

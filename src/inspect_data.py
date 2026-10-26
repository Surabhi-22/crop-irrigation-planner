
from pathlib import Path
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = PROJECT_ROOT / "data" / "raw"

files_to_inspect = [
    "crop_price_dataset.csv",
    "indian_agriculture_realistic_dataset.csv",
    "Agro_India_States.csv",
]

for filename in files_to_inspect:
    file_path = RAW_DIR / filename

    print("\n" + "=" * 60)
    print(f"DATASET: {filename}")

    if not file_path.exists():
        print("File not found. Check its location and filename.")
        continue

    try:
        df = pd.read_csv(file_path, low_memory=False)

        print("\nShape (rows, columns):", df.shape)
        print("\nColumn names:")
        print(df.columns.tolist())

        print("\nFirst 5 rows:")
        print(df.head().to_string(index=False))

        print("\nData types:")
        print(df.dtypes.to_string())

        print("\nMissing values per column:")
        print(df.isnull().sum().to_string())

    except Exception as error:
        print("Could not inspect this file:", error)

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

print("\n" + "=" * 60)
print("DATASET: India Agriculture Crop Production")

if csv_path.exists():
    df = pd.read_csv(csv_path, low_memory=False)

    print("\nShape (rows, columns):", df.shape)
    print("\nColumn names:")
    print(df.columns.tolist())

    print("\nFirst 5 rows:")
    print(df.head().to_string(index=False))

    print("\nData types:")
    print(df.dtypes.to_string())

    print("\nMissing values per column:")
    print(df.isnull().sum().to_string())
else:
    print("CSV file not found. Check the folder and filename.")

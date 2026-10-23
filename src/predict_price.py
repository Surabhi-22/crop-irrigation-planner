"""Market price prediction module and inference CLI.

Loads the trained Random Forest model (models/price_model.joblib)
and predicts crop modal market price (INR per quintal for major commodities)
with strict input validation and rejection of unseen categories.
"""

from pathlib import Path
import math
import pandas as pd
import joblib

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = BASE_DIR / "models" / "price_model.joblib"
DATA_FILE = BASE_DIR / "data" / "processed" / "price_training_data.csv"

# Load model
if not MODEL_PATH.exists():
    raise FileNotFoundError(
        f"Trained price model not found at {MODEL_PATH}. Run src/train_price_model.py first."
    )

model = joblib.load(MODEL_PATH)

# Known commodities and canonical lookup mapping (all 16 commodities from training)
KNOWN_CROPS = {
    "barley": "Barley (Jau)",
    "barley (jau)": "Barley (Jau)",
    "jau": "Barley (Jau)",
    "coconut": "Coconut",
    "coffee": "Coffee",
    "cotton": "Cotton",
    "ginger": "Ginger(Dry)",
    "ginger(dry)": "Ginger(Dry)",
    "dry ginger": "Ginger(Dry)",
    "groundnut": "Groundnut",
    "peanut": "Groundnut",
    "jowar": "Jowar(Sorghum)",
    "sorghum": "Jowar(Sorghum)",
    "jowar(sorghum)": "Jowar(Sorghum)",
    "maize": "Maize",
    "corn": "Maize",
    "millets": "Millets",
    "millet": "Millets",
    "rice": "Rice",
    "paddy": "Rice",
    "sugar": "Sugar",
    "sugarcane": "Sugarcane",
    "sunflower": "Sunflower",
    "tea": "Tea",
    "turmeric": "Turmeric",
    "wheat": "Wheat",
}

# Unit and reliability notes per crop
CROP_NOTES = {
    "Sugarcane": "CAUTION: Raw dataset exhibits mixed units (Rs 7 to Rs 33,000). Official FRP is ~Rs 300-350/quintal.",
    "Coconut": "CAUTION: Mandi reporting mixes price per quintal (copra) and price per 1,000 nuts.",
    "Coffee": "NOTE: Global commodity subject to international market shocks (e.g. 2024-2025 supply shortages).",
    "Groundnut": "HIGH RELIABILITY: Historical test relative error ~10.5% (approx INR/quintal).",
    "Rice": "HIGH RELIABILITY: Historical test relative error ~15.3% (approx INR/quintal).",
    "Wheat": "HIGH RELIABILITY: Historical test relative error ~23.9% (approx INR/quintal).",
    "Maize": "HIGH RELIABILITY: Historical test relative error ~27.0% (approx INR/quintal).",
    "Cotton": "HIGH RELIABILITY: Historical test relative error ~19.5% (approx INR/quintal).",
    "Millets": "HIGH RELIABILITY: Historical test relative error ~15.1% (approx INR/quintal).",
    "Sunflower": "HIGH RELIABILITY: Historical test relative error ~15.0% (approx INR/quintal).",
    "Sugar": "HIGH RELIABILITY: Historical test relative error ~9.1% (approx INR/quintal).",
}


def predict_crop_price(crop_name: str, year: int, month: int, verbose: bool = True) -> dict:
    """Predict expected modal market price for a given crop and calendar date.

    Parameters
    ----------
    crop_name : str
        Commodity name (e.g., 'Rice', 'Maize', 'Groundnut', 'Wheat').
    year : int
        Planning year (e.g., 2024, 2025).
    month : int
        Planning month (1 to 12).
    verbose : bool, default=True
        Whether to print formatted CLI output.

    Returns
    -------
    dict
        Dictionary with validated commodity name, year, month, predicted price,
        unit status, reliability note, and caveat.

    Raises
    ------
    ValueError
        If crop is unsupported/unseen, or if year/month are invalid or missing.
    """
    # 1. Validate Crop
    if not crop_name or not isinstance(crop_name, str) or not crop_name.strip():
        raise ValueError("Crop name cannot be empty or missing.")

    clean_key = crop_name.strip().lower()
    canonical_crop = KNOWN_CROPS.get(clean_key)
    if not canonical_crop:
        valid_options = sorted(list(set(KNOWN_CROPS.values())))
        raise ValueError(
            f"Unsupported crop '{crop_name}'. The market-price model was trained on 16 specific "
            f"national commodities and cannot reliably predict unseen crops. Available crops:\n"
            + ", ".join(valid_options)
        )

    # 2. Validate Year
    if year is None:
        raise ValueError("Year cannot be missing.")
    try:
        int_year = int(year)
    except (TypeError, ValueError):
        raise ValueError(f"Year must be an integer, got '{year}'.")
    if int_year < 2000 or int_year > 2035:
        raise ValueError(
            f"Year {int_year} is out of the realistic market planning horizon (2000-2035)."
        )

    # 3. Validate Month
    if month is None:
        raise ValueError("Month cannot be missing.")
    try:
        int_month = int(month)
    except (TypeError, ValueError):
        raise ValueError(f"Month must be an integer (1-12), got '{month}'.")
    if int_month < 1 or int_month > 12:
        raise ValueError(f"Month must be between 1 and 12, got {int_month}.")

    if canonical_crop == "Sugarcane":
        result = {
            "commodity": "Sugarcane",
            "input_crop": crop_name,
            "year": int_year,
            "month": int_month,
            "predicted_modal_price": None,
            "likely_unit": None,
            "unit_status": "unsupported_price_unit",
            "advisory": (
                "EXCLUDED FROM PRICE MODEL: Raw dataset exhibits severe unit mixing (Rs 7 to Rs 33,000). "
                "Official FRP is ~Rs 300-350/quintal. Price prediction is withheld as None."
            ),
            "temporal_horizon": "Post-split period (2022+)" if int_year >= 2022 else "Historical reference period (2010-2021)",
            "caveat": "Price prediction unavailable due to unverified source reporting units.",
        }
        if verbose:
            print("\n" + "=" * 55)
            print("CROP MARKET PRICE PREDICTION")
            print("=" * 55)
            print(f"Commodity Input   : {crop_name} -> Canonical: Sugarcane")
            print(f"Planning Horizon  : {int_year:04d}-{int_month:02d}")
            print("Predicted Price   : None (WITHHELD)")
            print("Unit Status       : unsupported_price_unit")
            print(f"Data Advisory     : {result['advisory']}")
            print("-" * 55)
            print("CRITICAL CAVEAT:")
            print(result["caveat"])
            print("=" * 55)
        return result

    # 4. Build input dataframe matching model pipeline expectations
    input_df = pd.DataFrame([{
        "commodity_name": canonical_crop,
        "year": int_year,
        "month_num": int_month,
    }])

    raw_pred = model.predict(input_df)[0]
    predicted_val = float(raw_pred)

    if math.isnan(predicted_val) or math.isinf(predicted_val):
        raise RuntimeError("Model returned a non-finite price prediction.")
    predicted_val = max(0.0, predicted_val)

    note = CROP_NOTES.get(canonical_crop, "Standard agricultural commodity.")

    result = {
        "commodity": canonical_crop,
        "input_crop": crop_name,
        "year": int_year,
        "month": int_month,
        "predicted_modal_price": round(predicted_val, 2),
        "likely_unit": "INR per Quintal (100 kg) [Agmarknet standard]",
        "unit_status": "Unverified in raw dataset header; marked unknown",
        "advisory": note,
        "temporal_horizon": "Post-split period (2022+)" if int_year >= 2022 else "Historical reference period (2010-2021)",
        "caveat": (
            "Reflects structural historical price benchmark and seasonality for planning; "
            "not a live day-to-day market forecast."
        ),
    }

    if verbose:
        print("\n" + "=" * 55)
        print("CROP MARKET PRICE PREDICTION")
        print("=" * 55)
        print(f"Commodity Input   : {crop_name} -> Canonical: {canonical_crop}")
        print(f"Planning Horizon  : {int_year:04d}-{int_month:02d}")
        print(f"Predicted Price   : INR {predicted_val:,.2f}")
        print(f"Likely Unit       : {result['likely_unit']}")
        print(f"Unit Status       : {result['unit_status']}")
        print(f"Temporal Horizon  : {result['temporal_horizon']}")
        print(f"Data Advisory     : {result['advisory']}")
        print("-" * 55)
        print("CRITICAL CAVEAT:")
        print(result["caveat"])
        print("=" * 55)

    return result


if __name__ == "__main__":
    sample_queries = [
        ("Rice", 2024, 11),
        ("Maize", 2025, 2),
        ("Groundnut", 2024, 10),
        ("Sugarcane", 2024, 12),
    ]

    print("Running sample predictions with trained market price model:\n")
    for c, y, m in sample_queries:
        predict_crop_price(c, y, m, verbose=True)

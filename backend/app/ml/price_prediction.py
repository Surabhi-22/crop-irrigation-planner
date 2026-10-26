"""Market-price prediction module for agricultural commodities.

Loads the trained Random Forest model (models/price_model.joblib) once at module
load and provides a documented, JSON-serializable prediction function.
"""

from pathlib import Path
import math
import re
from typing import Dict, Any, Optional
import pandas as pd
import joblib

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = BASE_DIR / "models" / "price_model.joblib"

if not MODEL_PATH.exists():
    raise FileNotFoundError(
        f"Price model not found at {MODEL_PATH}. Ensure train_price_model.py has been executed."
    )

# Load saved model pipeline once at import time
_PRICE_MODEL = joblib.load(MODEL_PATH)

# Supported 16 commodities from national market price dataset
PRICE_COMMODITIES: Dict[str, str] = {
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

# Commodities with documented severe unit mixing or distortions
# For these commodities, a reliable price-per-tonne cannot be verified from the source data.
COMMODITIES_WITH_MIXED_UNITS = {"Sugarcane", "Coconut"}


def predict_price(
    crop: str,
    market: Optional[str] = None,
    prediction_date: Optional[str] = None,
    year: Optional[int] = None,
    month: Optional[int] = None,
) -> Dict[str, Any]:
    """Predict expected wholesale market price for an agricultural commodity.

    Parameters
    ----------
    crop : str
        Commodity name (e.g., 'Rice', 'Maize', 'Wheat', 'Groundnut').
    market : Optional[str], default=None
        Target market or region (e.g., 'Karnataka' or 'All India').
        Note: The underlying model was trained on national benchmark data.
    prediction_date : Optional[str], default=None
        Target date string in format 'YYYY-MM' or 'YYYY-MM-DD'.
        If provided, year and month are extracted automatically.
    year : Optional[int], default=None
        Target planning year (e.g., 2024).
    month : Optional[int], default=None
        Target calendar month (1 to 12).

    Returns
    -------
    dict
        JSON-serializable prediction result with the following structure:
        - crop : str (canonical commodity name)
        - market : Optional[str]
        - year : int
        - month : int
        - predicted_yield_tonnes_per_hectare : None
        - predicted_price_per_tonne : Optional[float]
        - predicted_price_per_quintal : Optional[float]
        - price_unit : Optional[str]
        - status : str ("success" or "unsupported_price_unit")
        - limitations : List[str]

    Raises
    ------
    ValueError
        If inputs are missing, invalid, out of bounds, or reference an unseen commodity.
    """
    limitations = [
        "Model predicts national monthly modal wholesale benchmarks; it does not capture local mandi auction spreads.",
        "Reflects structural historical price benchmarks and seasonality; not a real-time live trading forecast."
    ]

    # If market parameter looks like a date string and prediction_date is omitted, treat as prediction_date
    if market is not None and prediction_date is None and re.match(r"^\d{4}[-/.]\d{1,2}", str(market).strip()):
        prediction_date = market
        market = None

    # 1. Validate Crop
    if not crop or not isinstance(crop, str) or not crop.strip():
        raise ValueError("Crop name cannot be empty or missing.")

    clean_crop_key = crop.strip().lower()
    canonical_crop = PRICE_COMMODITIES.get(clean_crop_key)
    if not canonical_crop:
        valid_commodities = sorted(list(set(PRICE_COMMODITIES.values())))
        raise ValueError(
            f"Unsupported commodity '{crop}'. The market-price model supports 16 specific "
            f"national commodities and cannot predict unseen crops. Available commodities:\n"
            + ", ".join(valid_commodities)
        )

    # 2. Parse and Validate Year & Month
    int_year: Optional[int] = None
    int_month: Optional[int] = None

    if prediction_date is not None:
        if not isinstance(prediction_date, str) or not prediction_date.strip():
            raise ValueError(f"Invalid prediction_date '{prediction_date}'. Expected format: 'YYYY-MM'.")
        # Extract YYYY and MM
        match = re.match(r"^(\d{4})[-/.](\d{1,2})", prediction_date.strip())
        if match:
            int_year = int(match.group(1))
            int_month = int(match.group(2))
        else:
            raise ValueError(f"Could not parse prediction_date '{prediction_date}'. Expected format: 'YYYY-MM' or 'YYYY-MM-DD'.")

    # Override or fill from direct year / month arguments if provided
    if year is not None:
        try:
            int_year = int(year)
        except (TypeError, ValueError):
            raise ValueError(f"Year must be an integer, got '{year}'.")

    if month is not None:
        try:
            int_month = int(month)
        except (TypeError, ValueError):
            raise ValueError(f"Month must be an integer between 1 and 12, got '{month}'.")

    if int_year is None or int_month is None:
        raise ValueError("Date information is incomplete. Provide either 'prediction_date' (e.g. '2024-11') or both 'year' and 'month'.")

    if int_year < 2000 or int_year > 2035:
        raise ValueError(f"Year {int_year} is out of the realistic market planning horizon (2000-2035).")

    if int_month < 1 or int_month > 12:
        raise ValueError(f"Month must be between 1 and 12, got {int_month}.")

    # Market notice
    if market is not None:
        limitations.append(f"Market parameter '{market}' received; note that predictions use national monthly averages ('district_name = All').")

    # 3. Check for severe unit mixing (Sugarcane, Coconut)
    # Requirement: If a reliable price-per-tonne cannot be produced because dataset units are unverified/mixed,
    # return an unsupported status and None instead of inventing a value.
    if canonical_crop in COMMODITIES_WITH_MIXED_UNITS:
        limitations.append(
            f"Reliable price-per-tonne prediction unavailable for '{canonical_crop}': Raw dataset exhibits severe unit mixing "
            f"(reporting varies across individual stalks, quintals, and 1,000 nuts), causing high historical prediction error (139.5% on Sugarcane). "
            f"Conversion to price-per-tonne is not reliable without verified source reporting units."
        )
        return {
            "crop": canonical_crop,
            "market": market,
            "year": int_year,
            "month": int_month,
            "predicted_yield_tonnes_per_hectare": None,
            "predicted_price_per_tonne": None,
            "predicted_price_per_quintal": None,
            "price_unit": None,
            "status": "unsupported_price_unit",
            "limitations": limitations,
        }

    # 4. Predict using model pipeline
    input_df = pd.DataFrame([{
        "commodity_name": canonical_crop,
        "year": int_year,
        "month_num": int_month,
    }])

    raw_pred = _PRICE_MODEL.predict(input_df)[0]
    predicted_val = float(raw_pred)

    if math.isnan(predicted_val) or math.isinf(predicted_val):
        raise RuntimeError("Price model returned a non-finite prediction.")
    predicted_val = max(0.0, predicted_val)

    # Standard grain/pulse/cash crops align with Agmarknet INR per quintal (100 kg) benchmarks.
    # 1 quintal = 100 kg; 1 tonne = 10 quintals.
    price_per_quintal = round(predicted_val, 2)
    price_per_tonne = round(predicted_val * 10.0, 2)

    limitations.append(
        "Price per tonne is calculated based on standard Agmarknet INR/quintal alignment (10 quintals = 1 tonne); "
        "raw dataset header lacks explicit unit confirmation."
    )

    return {
        "crop": canonical_crop,
        "market": market,
        "year": int_year,
        "month": int_month,
        "predicted_yield_tonnes_per_hectare": None,
        "predicted_price_per_tonne": price_per_tonne,
        "predicted_price_per_quintal": price_per_quintal,
        "price_unit": "INR per tonne (converted from INR per quintal benchmark)",
        "status": "success",
        "limitations": limitations,
    }


if __name__ == "__main__":
    demo1 = predict_price("Maize", year=2024, month=10)
    print("Maize Price Demo:")
    print(demo1)

    demo2 = predict_price("Sugarcane", year=2024, month=12)
    print("\nSugarcane Price Demo (Uncertain Units):")
    print(demo2)

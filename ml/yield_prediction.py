"""Yield prediction module for Karnataka agriculture.

Loads the trained Random Forest model (models/yield_model.joblib) once at module
load and provides a documented, JSON-serializable prediction function.
"""

from pathlib import Path
import math
from typing import Dict, Any, Optional
import pandas as pd
import joblib

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = BASE_DIR / "models" / "yield_model.joblib"

if not MODEL_PATH.exists():
    raise FileNotFoundError(
        f"Yield model not found at {MODEL_PATH}. Ensure train_yield_model.py has been executed."
    )

# Load saved model pipeline once at import time
_YIELD_MODEL = joblib.load(MODEL_PATH)

# Canonical mapping for Karnataka districts to handle alternative spellings
DISTRICT_MAPPING: Dict[str, str] = {
    "BAGALKOT": "BAGALKOTE",
    "BELLARY": "BALLARI",
    "BELGAUM": "BELAGAVI",
    "CHAMARAJANAGAR": "CHAMARAJANAGARA",
    "CHIKBALLAPUR": "CHIKKABALLAPURA",
    "CHIKMAGALUR": "CHIKKAMAGALURU",
    "DAKSHIN KANNAD": "DAKSHINA KANNADA",
    "GULBARGA": "KALABURAGI",
    "MYSORE": "MYSURU",
    "SHIMOGA": "SHIVAMOGGA",
    "TUMKUR": "TUMAKURU",
    "UTTAR KANNAD": "UTTARA KANNADA",
    "BIJAPUR": "VIJAYAPURA",
    "YADGIR": "YADAGIRI",
}

# The 30 canonical Karnataka districts present in the training data
SUPPORTED_DISTRICTS = {
    "BAGALKOTE", "BALLARI", "BANGALORE RURAL", "BELAGAVI", "BENGALURU URBAN",
    "BIDAR", "CHAMARAJANAGARA", "CHIKKABALLAPURA", "CHIKKAMAGALURU", "CHITRADURGA",
    "DAKSHINA KANNADA", "DAVANGERE", "DHARWAD", "GADAG", "HASSAN",
    "HAVERI", "KALABURAGI", "KODAGU", "KOLAR", "KOPPAL",
    "MANDYA", "MYSURU", "RAICHUR", "RAMANAGARA", "SHIVAMOGGA",
    "TUMAKURU", "UDUPI", "UTTARA KANNADA", "VIJAYAPURA", "YADAGIRI"
}

# The 42 canonical crops present in the Karnataka yield training dataset
SUPPORTED_CROPS: Dict[str, str] = {
    "arecanut": "Arecanut",
    "arhar/tur": "Arhar/Tur",
    "tur": "Arhar/Tur",
    "arhar": "Arhar/Tur",
    "pigeon pea": "Arhar/Tur",
    "bajra": "Bajra",
    "banana": "Banana",
    "black pepper": "Black pepper",
    "cardamom": "Cardamom",
    "cashewnut": "Cashewnut",
    "castor seed": "Castor seed",
    "coriander": "Coriander",
    "cowpea(lobia)": "Cowpea(Lobia)",
    "lobia": "Cowpea(Lobia)",
    "dry chillies": "Dry chillies",
    "garlic": "Garlic",
    "ginger": "Ginger",
    "gram": "Gram",
    "chickpea": "Gram",
    "groundnut": "Groundnut",
    "peanut": "Groundnut",
    "horse-gram": "Horse-gram",
    "jowar": "Jowar",
    "sorghum": "Jowar",
    "linseed": "Linseed",
    "maize": "Maize",
    "corn": "Maize",
    "moong(green gram)": "Moong(Green Gram)",
    "green gram": "Moong(Green Gram)",
    "moong": "Moong(Green Gram)",
    "niger seed": "Niger seed",
    "onion": "Onion",
    "other kharif pulses": "Other Kharif pulses",
    "other rabi pulses": "Other Rabi pulses",
    "peas & beans (pulses)": "Peas & beans (Pulses)",
    "potato": "Potato",
    "ragi": "Ragi",
    "finger millet": "Ragi",
    "rapeseed &mustard": "Rapeseed &Mustard",
    "mustard": "Rapeseed &Mustard",
    "rice": "Rice",
    "paddy": "Rice",
    "safflower": "Safflower",
    "sannhamp": "Sannhamp",
    "sesamum": "Sesamum",
    "sesame": "Sesamum",
    "small millets": "Small millets",
    "soyabean": "Soyabean",
    "soybean": "Soyabean",
    "sugarcane": "Sugarcane",
    "sunflower": "Sunflower",
    "sweet potato": "Sweet potato",
    "tapioca": "Tapioca",
    "tobacco": "Tobacco",
    "turmeric": "Turmeric",
    "urad": "Urad",
    "black gram": "Urad",
    "wheat": "Wheat",
}

# Recognized Karnataka agricultural seasons
SUPPORTED_SEASONS: Dict[str, str] = {
    "kharif": "Kharif",
    "rabi": "Rabi",
    "summer": "Summer",
    "whole year": "Whole Year",
    "whole_year": "Whole Year",
}


def predict_yield(
    crop: str,
    district: str,
    season: str,
    area_hectares: float,
    year: int
) -> Dict[str, Any]:
    """Predict expected crop yield and production for Karnataka agriculture.

    Parameters
    ----------
    crop : str
        Crop name (e.g., 'Rice', 'Maize', 'Sugarcane', 'Groundnut').
    district : str
        Karnataka agricultural district name (e.g., 'MYSURU', 'BELAGAVI').
    season : str
        Agricultural season ('Kharif', 'Rabi', 'Summer', 'Whole Year').
    area_hectares : float
        Cultivated land area in hectares (> 0).
    year : int
        Agricultural starting year (e.g., 2024).

    Returns
    -------
    dict
        JSON-serializable prediction result with the following structure:
        - crop : str (canonical crop name)
        - district : str (canonical district name)
        - season : str (canonical season)
        - year : int
        - area_hectares : float
        - predicted_yield_tonnes_per_hectare : float
        - estimated_production_tonnes : float
        - yield_unit : str ("tonnes per hectare")
        - status : str ("success")
        - limitations : List[str]

    Raises
    ------
    ValueError
        If inputs are missing, invalid, out of bounds, or reference an unseen
        crop or out-of-region district.
    """
    limitations = [
        "Model trained exclusively on Karnataka district-level historical observations (1997-2019).",
        "Predictions reflect expected agro-climatic norms; real-time weather anomalies (extreme drought/flood) are not modeled."
    ]

    # 1. Validate District
    if not district or not isinstance(district, str) or not district.strip():
        raise ValueError("District cannot be empty or missing.")
    clean_dist = district.strip().upper()
    canonical_district = DISTRICT_MAPPING.get(clean_dist, clean_dist)
    if canonical_district not in SUPPORTED_DISTRICTS:
        raise ValueError(
            f"Unsupported district '{district}'. The yield model is trained strictly on "
            f"Karnataka's 30 agricultural districts and does not support out-of-region districts."
        )

    # 2. Validate Crop
    if not crop or not isinstance(crop, str) or not crop.strip():
        raise ValueError("Crop name cannot be empty or missing.")
    clean_crop_key = crop.strip().lower()
    canonical_crop = SUPPORTED_CROPS.get(clean_crop_key)
    if not canonical_crop:
        valid_crops = sorted(list(set(SUPPORTED_CROPS.values())))
        raise ValueError(
            f"Unsupported crop '{crop}'. The model was trained on 42 Karnataka crops and "
            f"does not support unseen crop categories. Available crops:\n" + ", ".join(valid_crops)
        )

    # 3. Validate Season
    if not season or not isinstance(season, str) or not season.strip():
        raise ValueError("Season cannot be empty or missing.")
    clean_season_key = season.strip().lower()
    canonical_season = SUPPORTED_SEASONS.get(clean_season_key)
    if not canonical_season:
        raise ValueError(
            f"Unsupported season '{season}'. Must be one of: "
            f"['Kharif', 'Rabi', 'Summer', 'Whole Year']."
        )

    # 4. Validate Year
    if year is None:
        raise ValueError("Year cannot be missing.")
    try:
        int_year = int(year)
    except (TypeError, ValueError):
        raise ValueError(f"Year must be an integer, got '{year}'.")
    if int_year < 1990 or int_year > 2035:
        raise ValueError(f"Year {int_year} is out of the realistic planning horizon (1990-2035).")

    # 5. Validate Area
    if area_hectares is None:
        raise ValueError("Area cannot be missing.")
    try:
        float_area = float(area_hectares)
    except (TypeError, ValueError):
        raise ValueError(f"Area must be a numeric value, got '{area_hectares}'.")
    if math.isnan(float_area) or math.isinf(float_area) or float_area <= 0:
        raise ValueError(f"Area must be a positive finite number (> 0), got {area_hectares}.")

    # 6. Build model input row
    input_df = pd.DataFrame([{
        "District": canonical_district,
        "Crop": canonical_crop,
        "Year_start": int_year,
        "Season": canonical_season,
        "Area": float_area,
    }])

    raw_pred = _YIELD_MODEL.predict(input_df)[0]
    predicted_yield = float(raw_pred)

    if math.isnan(predicted_yield) or math.isinf(predicted_yield):
        raise RuntimeError("Model returned a non-finite prediction value.")
    predicted_yield = max(0.0, predicted_yield)

    estimated_production = predicted_yield * float_area

    if canonical_crop == "Sugarcane":
        limitations.append("Sugarcane is a high-biomass commercial cane crop; yields are measured in fresh stalk biomass (~80-120 t/ha).")

    return {
        "crop": canonical_crop,
        "district": canonical_district,
        "season": canonical_season,
        "year": int_year,
        "area_hectares": float_area,
        "predicted_yield_tonnes_per_hectare": round(predicted_yield, 3),
        "estimated_production_tonnes": round(estimated_production, 3),
        "yield_unit": "tonnes per hectare",
        "predicted_price_per_tonne": None,
        "price_unit": None,
        "status": "success",
        "limitations": limitations,
    }


if __name__ == "__main__":
    demo = predict_yield("Rice", "MYSORE", "Kharif", 2.5, 2024)
    print("Yield Prediction Demo:")
    print(demo)

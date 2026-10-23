"""Crop yield prediction module and inference CLI.

Loads the trained Random Forest model (models/yield_model.joblib)
and predicts crop yield (tonnes/hectare) and total production (tonnes)
with strict input validation and rejection of unseen categories.
"""

from pathlib import Path
import math
import pandas as pd
import joblib

BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = BASE_DIR / "models" / "yield_model.joblib"

# Load trained yield model pipeline
if not MODEL_PATH.exists():
    raise FileNotFoundError(
        f"Yield model not found at {MODEL_PATH}. Run src/train_yield_model.py first."
    )

model = joblib.load(MODEL_PATH)

# Canonical mapping for Karnataka districts to handle old/new spellings gracefully
DISTRICT_MAPPING = {
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

# The 30 canonical Karnataka districts present during training
SUPPORTED_DISTRICTS = {
    "BAGALKOTE", "BALLARI", "BANGALORE RURAL", "BELAGAVI", "BENGALURU URBAN",
    "BIDAR", "CHAMARAJANAGARA", "CHIKKABALLAPURA", "CHIKKAMAGALURU", "CHITRADURGA",
    "DAKSHINA KANNADA", "DAVANGERE", "DHARWAD", "GADAG", "HASSAN",
    "HAVERI", "KALABURAGI", "KODAGU", "KOLAR", "KOPPAL",
    "MANDYA", "MYSURU", "RAICHUR", "RAMANAGARA", "SHIVAMOGGA",
    "TUMAKURU", "UDUPI", "UTTARA KANNADA", "VIJAYAPURA", "YADAGIRI"
}

# The 42 canonical crops present in the Karnataka yield training dataset
SUPPORTED_CROPS = {
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

# Supported seasons in Karnataka agriculture
SUPPORTED_SEASONS = {
    "kharif": "Kharif",
    "rabi": "Rabi",
    "summer": "Summer",
    "whole year": "Whole Year",
    "whole_year": "Whole Year",
}


def predict_crop_yield(
    district: str,
    crop: str,
    year: int,
    season: str,
    area: float
) -> dict:
    """Predict expected crop yield and total production for Karnataka agriculture.

    Parameters
    ----------
    district : str
        Karnataka agricultural district name (e.g., 'MYSURU', 'BELAGAVI').
    crop : str
        Crop name (e.g., 'Rice', 'Maize', 'Sugarcane').
    year : int
        Agricultural starting year (e.g., 2018 or 2020).
    season : str
        Agricultural season ('Kharif', 'Rabi', 'Summer', 'Whole Year').
    area : float
        Cultivated land area in hectares (> 0).

    Returns
    -------
    dict
        Dictionary containing validated inputs, predicted yield (tonnes/hectare),
        total production (tonnes), and unit metadata.

    Raises
    ------
    ValueError
        If inputs are missing, non-numeric, out of range, or reference an unseen/unsupported category.
    """
    # 1. Validate District
    if not district or not isinstance(district, str) or not district.strip():
        raise ValueError("District cannot be empty or missing.")
    clean_dist = district.strip().upper()
    canonical_district = DISTRICT_MAPPING.get(clean_dist, clean_dist)
    if canonical_district not in SUPPORTED_DISTRICTS:
        raise ValueError(
            f"Unsupported district '{district}'. The model is specifically trained for "
            f"Karnataka's 30 agricultural districts and does not support out-of-region or unseen districts."
        )

    # 2. Validate Crop
    if not crop or not isinstance(crop, str) or not crop.strip():
        raise ValueError("Crop cannot be empty or missing.")
    clean_crop_key = crop.strip().lower()
    canonical_crop = SUPPORTED_CROPS.get(clean_crop_key)
    if not canonical_crop:
        raise ValueError(
            f"Unsupported crop '{crop}'. The model was trained on 42 Karnataka crops and "
            f"cannot reliably predict yield for unseen crop categories."
        )

    # 3. Validate Season
    if not season or not isinstance(season, str) or not season.strip():
        raise ValueError("Season cannot be empty or missing.")
    clean_season_key = season.strip().lower()
    canonical_season = SUPPORTED_SEASONS.get(clean_season_key)
    if not canonical_season:
        raise ValueError(
            f"Unsupported season '{season}'. Season must be one of: "
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
        raise ValueError(
            f"Year {int_year} is out of the realistic agricultural planning horizon (1990-2035)."
        )

    # 5. Validate Area
    if area is None:
        raise ValueError("Area cannot be missing.")
    try:
        float_area = float(area)
    except (TypeError, ValueError):
        raise ValueError(f"Area must be a numeric value, got '{area}'.")
    if math.isnan(float_area) or math.isinf(float_area) or float_area <= 0:
        raise ValueError(f"Area must be a positive finite number (> 0), got {area}.")

    # 6. Build input row for model pipeline
    input_df = pd.DataFrame([{
        "District": canonical_district,
        "Crop": canonical_crop,
        "Year_start": int_year,
        "Season": canonical_season,
        "Area": float_area,
    }])

    # 7. Predict using scikit-learn pipeline
    raw_pred = model.predict(input_df)[0]
    predicted_yield = float(raw_pred)

    # Ensure output is finite and non-negative
    if math.isnan(predicted_yield) or math.isinf(predicted_yield):
        raise RuntimeError("Model returned a non-finite prediction value.")
    predicted_yield = max(0.0, predicted_yield)

    estimated_production = predicted_yield * float_area

    return {
        "district": canonical_district,
        "crop": canonical_crop,
        "year": int_year,
        "season": canonical_season,
        "area_hectares": float_area,
        "predicted_yield_tonnes_per_hectare": round(predicted_yield, 3),
        "estimated_production_tonnes": round(estimated_production, 3),
        "yield_unit": "tonnes/hectare",
        "production_unit": "tonnes",
    }


if __name__ == "__main__":
    # Example farmer inputs
    result = predict_crop_yield(
        district="MYSORE",
        crop="Rice",
        year=2020,
        season="Kharif",
        area=2.0
    )

    print("\nCROP YIELD PREDICTION")
    print("--------------------")
    print(f"District: {result['district']}")
    print(f"Crop: {result['crop']}")
    print(f"Year: {result['year']}")
    print(f"Season: {result['season']}")
    print(f"Area: {result['area_hectares']:.1f} hectares")
    print(f"Predicted yield: {result['predicted_yield_tonnes_per_hectare']:.3f} {result['yield_unit']}")
    print(f"Estimated total production: {result['estimated_production_tonnes']:.3f} {result['production_unit']}")

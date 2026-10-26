"""Prediction Service: Unified prediction interface for Crop Yield & Market Price.

This module provides a reliable, shared prediction interface for Member 2 and Member 3.
It harmonizes crop names between the Karnataka yield model (42 crops, district-level)
and the national market-price model (16 commodities, monthly level), validates inputs,
handles unit uncertainty transparently, and rejects unseen categories without silent fallbacks.
"""

import sys
from pathlib import Path
import math
from typing import Optional, Dict, Any, List

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from src.predict_yield import (
    predict_crop_yield,
    DISTRICT_MAPPING,
    SUPPORTED_DISTRICTS,
    SUPPORTED_SEASONS,
)
from src.predict_price import (
    predict_crop_price,
    KNOWN_CROPS as PRICE_KNOWN_CROPS,
)

# Unified crop cross-model mapping table
# Maps user-facing input crop strings to their respective canonical names in Yield and Price models.
CROP_MODEL_MAPPING: Dict[str, Dict[str, Optional[str]]] = {
    # --- Dual-supported crops (both Yield and Market Price available) ---
    "rice": {"canonical": "Rice", "yield_crop": "Rice", "price_crop": "Rice"},
    "paddy": {"canonical": "Rice", "yield_crop": "Rice", "price_crop": "Rice"},
    "maize": {"canonical": "Maize", "yield_crop": "Maize", "price_crop": "Maize"},
    "corn": {"canonical": "Maize", "yield_crop": "Maize", "price_crop": "Maize"},
    "wheat": {"canonical": "Wheat", "yield_crop": "Wheat", "price_crop": "Wheat"},
    "groundnut": {"canonical": "Groundnut", "yield_crop": "Groundnut", "price_crop": "Groundnut"},
    "peanut": {"canonical": "Groundnut", "yield_crop": "Groundnut", "price_crop": "Groundnut"},
    "sunflower": {"canonical": "Sunflower", "yield_crop": "Sunflower", "price_crop": "Sunflower"},
    "jowar": {"canonical": "Jowar", "yield_crop": "Jowar", "price_crop": "Jowar(Sorghum)"},
    "sorghum": {"canonical": "Jowar", "yield_crop": "Jowar", "price_crop": "Jowar(Sorghum)"},
    "jowar(sorghum)": {"canonical": "Jowar", "yield_crop": "Jowar", "price_crop": "Jowar(Sorghum)"},
    "turmeric": {"canonical": "Turmeric", "yield_crop": "Turmeric", "price_crop": "Turmeric"},
    "ginger": {"canonical": "Ginger", "yield_crop": "Ginger", "price_crop": "Ginger(Dry)"},
    "ginger(dry)": {"canonical": "Ginger", "yield_crop": "Ginger", "price_crop": "Ginger(Dry)"},
    "dry ginger": {"canonical": "Ginger", "yield_crop": "Ginger", "price_crop": "Ginger(Dry)"},
    "sugarcane": {"canonical": "Sugarcane", "yield_crop": "Sugarcane", "price_crop": "Sugarcane"},

    # --- Millets mapping ---
    "small millets": {"canonical": "Small millets", "yield_crop": "Small millets", "price_crop": "Millets"},
    "millets": {"canonical": "Small millets", "yield_crop": "Small millets", "price_crop": "Millets"},
    "bajra": {"canonical": "Bajra", "yield_crop": "Bajra", "price_crop": "Millets"},
    "ragi": {"canonical": "Ragi", "yield_crop": "Ragi", "price_crop": "Millets"},

    # --- Price-only commodities (not in Yield model due to non-tonne units or tree crops) ---
    "cotton": {"canonical": "Cotton", "yield_crop": None, "price_crop": "Cotton"},
    "coconut": {"canonical": "Coconut", "yield_crop": None, "price_crop": "Coconut"},
    "coffee": {"canonical": "Coffee", "yield_crop": None, "price_crop": "Coffee"},
    "tea": {"canonical": "Tea", "yield_crop": None, "price_crop": "Tea"},
    "barley": {"canonical": "Barley (Jau)", "yield_crop": None, "price_crop": "Barley (Jau)"},
    "barley (jau)": {"canonical": "Barley (Jau)", "yield_crop": None, "price_crop": "Barley (Jau)"},
    "sugar": {"canonical": "Sugar", "yield_crop": None, "price_crop": "Sugar"},

    # --- Yield-only crops (in Karnataka yield data, but not in 16 national market price commodities) ---
    "arecanut": {"canonical": "Arecanut", "yield_crop": "Arecanut", "price_crop": None},
    "arhar/tur": {"canonical": "Arhar/Tur", "yield_crop": "Arhar/Tur", "price_crop": None},
    "tur": {"canonical": "Arhar/Tur", "yield_crop": "Arhar/Tur", "price_crop": None},
    "banana": {"canonical": "Banana", "yield_crop": "Banana", "price_crop": None},
    "black pepper": {"canonical": "Black pepper", "yield_crop": "Black pepper", "price_crop": None},
    "cardamom": {"canonical": "Cardamom", "yield_crop": "Cardamom", "price_crop": None},
    "cashewnut": {"canonical": "Cashewnut", "yield_crop": "Cashewnut", "price_crop": None},
    "castor seed": {"canonical": "Castor seed", "yield_crop": "Castor seed", "price_crop": None},
    "coriander": {"canonical": "Coriander", "yield_crop": "Coriander", "price_crop": None},
    "cowpea(lobia)": {"canonical": "Cowpea(Lobia)", "yield_crop": "Cowpea(Lobia)", "price_crop": None},
    "dry chillies": {"canonical": "Dry chillies", "yield_crop": "Dry chillies", "price_crop": None},
    "garlic": {"canonical": "Garlic", "yield_crop": "Garlic", "price_crop": None},
    "gram": {"canonical": "Gram", "yield_crop": "Gram", "price_crop": None},
    "chickpea": {"canonical": "Gram", "yield_crop": "Gram", "price_crop": None},
    "horse-gram": {"canonical": "Horse-gram", "yield_crop": "Horse-gram", "price_crop": None},
    "linseed": {"canonical": "Linseed", "yield_crop": "Linseed", "price_crop": None},
    "moong(green gram)": {"canonical": "Moong(Green Gram)", "yield_crop": "Moong(Green Gram)", "price_crop": None},
    "niger seed": {"canonical": "Niger seed", "yield_crop": "Niger seed", "price_crop": None},
    "onion": {"canonical": "Onion", "yield_crop": "Onion", "price_crop": None},
    "other kharif pulses": {"canonical": "Other Kharif pulses", "yield_crop": "Other Kharif pulses", "price_crop": None},
    "other rabi pulses": {"canonical": "Other Rabi pulses", "yield_crop": "Other Rabi pulses", "price_crop": None},
    "peas & beans (pulses)": {"canonical": "Peas & beans (Pulses)", "yield_crop": "Peas & beans (Pulses)", "price_crop": None},
    "potato": {"canonical": "Potato", "yield_crop": "Potato", "price_crop": None},
    "rapeseed &mustard": {"canonical": "Rapeseed &Mustard", "yield_crop": "Rapeseed &Mustard", "price_crop": None},
    "safflower": {"canonical": "Safflower", "yield_crop": "Safflower", "price_crop": None},
    "sannhamp": {"canonical": "Sannhamp", "yield_crop": "Sannhamp", "price_crop": None},
    "sesamum": {"canonical": "Sesamum", "yield_crop": "Sesamum", "price_crop": None},
    "soyabean": {"canonical": "Soyabean", "yield_crop": "Soyabean", "price_crop": None},
    "sweet potato": {"canonical": "Sweet potato", "yield_crop": "Sweet potato", "price_crop": None},
    "tapioca": {"canonical": "Tapioca", "yield_crop": "Tapioca", "price_crop": None},
    "tobacco": {"canonical": "Tobacco", "yield_crop": "Tobacco", "price_crop": None},
    "urad": {"canonical": "Urad", "yield_crop": "Urad", "price_crop": None},
}

# Crops with documented severe unit mixing or distortions in raw price data
# For these crops, price CANNOT be presented as a reliable INR/quintal figure.
CROPS_WITH_MIXED_PRICE_UNITS = {"Sugarcane", "Coconut"}


def predict_crop_metrics(
    crop: str,
    district: str,
    year: int,
    month: Optional[int] = None,
    season: Optional[str] = None,
    area: float = 1.0,
) -> Dict[str, Any]:
    """Single shared prediction interface returning both yield and market-price estimates.

    Parameters
    ----------
    crop : str
        Crop / commodity name (e.g., 'Rice', 'Maize', 'Sugarcane', 'Groundnut').
    district : str
        Karnataka agricultural district name (e.g., 'MYSURU', 'BELAGAVI').
    year : int
        Agricultural / planning year (e.g., 2024, 2025).
    month : Optional[int], default=None
        Target calendar month (1 to 12). If omitted but season is given,
        the representative harvest month for that season is inferred.
    season : Optional[str], default=None
        Agricultural season ('Kharif', 'Rabi', 'Summer', 'Whole Year').
        If omitted but month is given, season is inferred from the month.
    area : float, default=1.0
        Cultivated land area in hectares (> 0).

    Returns
    -------
    dict
        Structured prediction response with the exact required schema:
        - crop : str (canonical crop name)
        - district : str (canonical district name)
        - year : int
        - month : int
        - predicted_yield_tonnes_per_hectare : Optional[float]
        - predicted_price_inr_per_quintal : Optional[float]
        - price_unit_status : str
        - warnings : List[str]

    Raises
    ------
    ValueError
        If inputs are missing, invalid, out of bounds, or reference an unsupported
        crop or out-of-region district.
    """
    warnings: List[str] = []

    # -------------------------------------------------------------
    # 1. Input Validation: Crop
    # -------------------------------------------------------------
    if not crop or not isinstance(crop, str) or not crop.strip():
        raise ValueError("Crop name cannot be empty or missing.")

    clean_crop_key = crop.strip().lower()
    crop_info = CROP_MODEL_MAPPING.get(clean_crop_key)
    if not crop_info:
        valid_crops = sorted(list(set(v["canonical"] for v in CROP_MODEL_MAPPING.values())))
        raise ValueError(
            f"Unsupported crop '{crop}'. The model does not support unseen crop categories. "
            f"Available crops include:\n" + ", ".join(valid_crops)
        )

    canonical_crop = crop_info["canonical"]
    yield_crop = crop_info["yield_crop"]
    price_crop = crop_info["price_crop"]

    # -------------------------------------------------------------
    # 2. Input Validation: District
    # -------------------------------------------------------------
    if not district or not isinstance(district, str) or not district.strip():
        raise ValueError("District cannot be empty or missing.")

    clean_dist = district.strip().upper()
    canonical_district = DISTRICT_MAPPING.get(clean_dist, clean_dist)
    if canonical_district not in SUPPORTED_DISTRICTS:
        raise ValueError(
            f"Unsupported district '{district}'. The system is specifically calibrated for "
            f"Karnataka's 30 agricultural districts and does not support out-of-region or unseen districts."
        )

    # -------------------------------------------------------------
    # 3. Input Validation: Year
    # -------------------------------------------------------------
    if year is None:
        raise ValueError("Year cannot be missing.")
    try:
        int_year = int(year)
    except (TypeError, ValueError):
        raise ValueError(f"Year must be an integer, got '{year}'.")

    if int_year < 1990 or int_year > 2035:
        raise ValueError(f"Year {int_year} is out of the realistic planning horizon (1990-2035).")

    # -------------------------------------------------------------
    # 4. Input Validation: Area
    # -------------------------------------------------------------
    if area is None:
        raise ValueError("Area cannot be missing.")
    try:
        float_area = float(area)
    except (TypeError, ValueError):
        raise ValueError(f"Area must be a numeric value, got '{area}'.")

    if math.isnan(float_area) or math.isinf(float_area) or float_area <= 0:
        raise ValueError(f"Area must be a positive finite number (> 0), got {area}.")

    # -------------------------------------------------------------
    # 5. Harmonize Month and Season
    # -------------------------------------------------------------
    if month is None and season is None:
        raise ValueError("At least one of 'month' (1-12) or 'season' must be provided.")

    # Validate month if given
    int_month: Optional[int] = None
    if month is not None:
        try:
            int_month = int(month)
        except (TypeError, ValueError):
            raise ValueError(f"Month must be an integer between 1 and 12, got '{month}'.")
        if int_month < 1 or int_month > 12:
            raise ValueError(f"Month must be between 1 and 12, got {int_month}.")

    # Validate season if given
    canonical_season: Optional[str] = None
    if season is not None:
        clean_season = season.strip().lower()
        canonical_season = SUPPORTED_SEASONS.get(clean_season)
        if not canonical_season:
            raise ValueError(
                f"Unsupported season '{season}'. Must be one of: "
                f"['Kharif', 'Rabi', 'Summer', 'Whole Year']."
            )

    # Harmonize month and season when one is omitted
    if canonical_season is None and int_month is not None:
        if canonical_crop == "Sugarcane":
            canonical_season = "Whole Year"
            warnings.append("Season defaulted to 'Whole Year' for perennial/annual crop Sugarcane.")
        elif int_month in [6, 7, 8, 9, 10]:
            canonical_season = "Kharif"
            warnings.append(f"Season inferred as 'Kharif' from calendar month {int_month}.")
        elif int_month in [11, 12, 1, 2, 3]:
            canonical_season = "Rabi"
            warnings.append(f"Season inferred as 'Rabi' from calendar month {int_month}.")
        else:
            canonical_season = "Summer"
            warnings.append(f"Season inferred as 'Summer' from calendar month {int_month}.")

    if int_month is None and canonical_season is not None:
        # Assign typical harvest/marketing month for that season
        season_to_month = {
            "Kharif": 10,       # October (post-monsoon harvest)
            "Rabi": 2,          # February (winter harvest)
            "Summer": 5,        # May (pre-monsoon harvest)
            "Whole Year": 12,   # December
        }
        int_month = season_to_month.get(canonical_season, 10)
        warnings.append(f"Month not specified; inferred month {int_month} as representative harvest month for season '{canonical_season}'.")

    # -------------------------------------------------------------
    # 6. Execute Yield Prediction
    # -------------------------------------------------------------
    predicted_yield: Optional[float] = None
    if yield_crop is not None:
        try:
            yield_res = predict_crop_yield(
                district=canonical_district,
                crop=yield_crop,
                year=int_year,
                season=canonical_season,
                area=float_area,
            )
            predicted_yield = yield_res["predicted_yield_tonnes_per_hectare"]
        except Exception as e:
            warnings.append(f"Yield model execution error: {str(e)}")
    else:
        warnings.append(
            f"Yield prediction unavailable: Crop '{canonical_crop}' is not present in the Karnataka "
            f"yield model (excluded due to non-tonne reporting units like bales or nuts)."
        )

    # -------------------------------------------------------------
    # 7. Execute Market Price Prediction & Unit Verification
    # -------------------------------------------------------------
    predicted_price: Optional[float] = None
    price_unit_status: str = "UNAVAILABLE"

    if price_crop is not None:
        # Check if the crop has documented mixed or distorted price units (Sugarcane, Coconut)
        if canonical_crop in CROPS_WITH_MIXED_PRICE_UNITS:
            predicted_price = None
            price_unit_status = "UNVERIFIED_MIXED_UNITS"
            warnings.append(
                f"Market price unavailable as reliable INR/quintal: Raw dataset contains severe unit mixing "
                f"for '{canonical_crop}' (prices vary between single stalks, quintals, and 1,000 nuts) "
                f"resulting in unacceptably high historical error (139.5% relative error on Sugarcane). "
                f"Do not present unverified values as commercial price estimates."
            )
        else:
            try:
                # Predict price using price model
                price_res = predict_crop_price(
                    crop_name=price_crop,
                    year=int_year,
                    month=int_month,
                    verbose=False,
                )
                predicted_price = price_res["predicted_modal_price"]
                # Unit alignment warning: The price values align standardly with Agmarknet wholesale
                # norms (INR/quintal), but the raw CSV header has no explicit unit label.
                price_unit_status = "UNVERIFIED_STANDARD_ALIGNMENT"
                warnings.append(
                    f"Price unit unverified in raw dataset header: Values align standardly with Agmarknet "
                    f"INR per quintal (100 kg) benchmarks for major field crops, but source provenance lacks explicit unit labels."
                )
            except Exception as e:
                predicted_price = None
                price_unit_status = "ERROR"
                warnings.append(f"Market price model execution error: {str(e)}")
    else:
        predicted_price = None
        price_unit_status = "UNAVAILABLE_NOT_IN_PRICE_DATA"
        warnings.append(
            f"Market price prediction unavailable: Crop '{canonical_crop}' is not covered by the 16 national market price commodities."
        )

    # -------------------------------------------------------------
    # 8. Assemble Documented Response Structure
    # -------------------------------------------------------------
    return {
        "crop": canonical_crop,
        "district": canonical_district,
        "year": int_year,
        "month": int_month,
        "predicted_yield_tonnes_per_hectare": predicted_yield,
        "predicted_price_inr_per_quintal": predicted_price,
        "price_unit_status": price_unit_status,
        "warnings": warnings,
    }


# Convenience aliases for team members
get_crop_prediction = predict_crop_metrics
predict_crop_plan = predict_crop_metrics


if __name__ == "__main__":
    print("Testing Prediction Service with sample queries:\n")
    samples = [
        {"crop": "Rice", "district": "MYSURU", "year": 2024, "month": 11, "season": "Kharif", "area": 2.5},
        {"crop": "Maize", "district": "BELAGAVI", "year": 2024, "month": 10, "season": "Kharif", "area": 4.0},
        {"crop": "Sugarcane", "district": "MANDYA", "year": 2024, "month": 12, "season": "Whole Year", "area": 1.0},
        {"crop": "Onion", "district": "DHARWAD", "year": 2024, "month": 9, "season": "Kharif", "area": 1.5},
        {"crop": "Cotton", "district": "BALLARI", "year": 2024, "month": 11, "season": "Kharif", "area": 3.0},
    ]

    for s in samples:
        res = predict_crop_metrics(**s)
        print(f"Query: {s['crop']} in {s['district']} ({s['year']})")
        print(f"  Yield (t/ha)       : {res['predicted_yield_tonnes_per_hectare']}")
        print(f"  Price (INR/quintal): {res['predicted_price_inr_per_quintal']}")
        print(f"  Price Unit Status  : {res['price_unit_status']}")
        print(f"  Warnings ({len(res['warnings'])}):")
        for w in res['warnings']:
            print(f"    - {w}")
        print()

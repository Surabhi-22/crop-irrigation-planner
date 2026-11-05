"""Unified Prediction Service for Member 2 and Member 3.

Provides a clean, reusable interface that integrates both the Karnataka Crop Yield model
and the National Market-Price model. It handles input validation, crop name harmonization,
seasonal inference, and unit transparency without re-training models.
"""

from pathlib import Path
import math
import re
from typing import Dict, Any, Optional, List

try:
    from .yield_prediction import predict_yield, SUPPORTED_DISTRICTS, SUPPORTED_CROPS, DISTRICT_MAPPING
    from .price_prediction import predict_price, PRICE_COMMODITIES, COMMODITIES_WITH_MIXED_UNITS
except ImportError:
    from ml.yield_prediction import predict_yield, SUPPORTED_DISTRICTS, SUPPORTED_CROPS, DISTRICT_MAPPING
    from ml.price_prediction import predict_price, PRICE_COMMODITIES, COMMODITIES_WITH_MIXED_UNITS

# Unified crop cross-model lookup
# Maps common crop names to their respective model identities
CROP_ALIGNMENT: Dict[str, Dict[str, Optional[str]]] = {
    # Dual-supported crops
    "rice": {"canonical": "Rice", "yield_name": "Rice", "price_name": "Rice"},
    "paddy": {"canonical": "Rice", "yield_name": "Rice", "price_name": "Rice"},
    "maize": {"canonical": "Maize", "yield_name": "Maize", "price_name": "Maize"},
    "corn": {"canonical": "Maize", "yield_name": "Maize", "price_name": "Maize"},
    "wheat": {"canonical": "Wheat", "yield_name": "Wheat", "price_name": "Wheat"},
    "groundnut": {"canonical": "Groundnut", "yield_name": "Groundnut", "price_name": "Groundnut"},
    "peanut": {"canonical": "Groundnut", "yield_name": "Groundnut", "price_name": "Groundnut"},
    "sunflower": {"canonical": "Sunflower", "yield_name": "Sunflower", "price_name": "Sunflower"},
    "jowar": {"canonical": "Jowar", "yield_name": "Jowar", "price_name": "Jowar(Sorghum)"},
    "sorghum": {"canonical": "Jowar", "yield_name": "Jowar", "price_name": "Jowar(Sorghum)"},
    "jowar(sorghum)": {"canonical": "Jowar", "yield_name": "Jowar", "price_name": "Jowar(Sorghum)"},
    "turmeric": {"canonical": "Turmeric", "yield_name": "Turmeric", "price_name": "Turmeric"},
    "ginger": {"canonical": "Ginger", "yield_name": "Ginger", "price_name": "Ginger(Dry)"},
    "ginger(dry)": {"canonical": "Ginger", "yield_name": "Ginger", "price_name": "Ginger(Dry)"},
    "dry ginger": {"canonical": "Ginger", "yield_name": "Ginger", "price_name": "Ginger(Dry)"},
    "sugarcane": {"canonical": "Sugarcane", "yield_name": "Sugarcane", "price_name": "Sugarcane"},

    # Millets
    "small millets": {"canonical": "Small millets", "yield_name": "Small millets", "price_name": "Millets"},
    "millets": {"canonical": "Small millets", "yield_name": "Small millets", "price_name": "Millets"},
    "bajra": {"canonical": "Bajra", "yield_name": "Bajra", "price_name": "Millets"},
    "ragi": {"canonical": "Ragi", "yield_name": "Ragi", "price_name": "Millets"},

    # Price-only commodities
    "cotton": {"canonical": "Cotton", "yield_name": None, "price_name": "Cotton"},
    "coconut": {"canonical": "Coconut", "yield_name": None, "price_name": "Coconut"},
    "coffee": {"canonical": "Coffee", "yield_name": None, "price_name": "Coffee"},
    "tea": {"canonical": "Tea", "yield_name": None, "price_name": "Tea"},
    "barley": {"canonical": "Barley (Jau)", "yield_name": None, "price_name": "Barley (Jau)"},
    "barley (jau)": {"canonical": "Barley (Jau)", "yield_name": None, "price_name": "Barley (Jau)"},
    "sugar": {"canonical": "Sugar", "yield_name": None, "price_name": "Sugar"},

    # Yield-only crops (42 Karnataka crops)
    "arecanut": {"canonical": "Arecanut", "yield_name": "Arecanut", "price_name": None},
    "arhar/tur": {"canonical": "Arhar/Tur", "yield_name": "Arhar/Tur", "price_name": None},
    "tur": {"canonical": "Arhar/Tur", "yield_name": "Arhar/Tur", "price_name": None},
    "banana": {"canonical": "Banana", "yield_name": "Banana", "price_name": None},
    "black pepper": {"canonical": "Black pepper", "yield_name": "Black pepper", "price_name": None},
    "cardamom": {"canonical": "Cardamom", "yield_name": "Cardamom", "price_name": None},
    "cashewnut": {"canonical": "Cashewnut", "yield_name": "Cashewnut", "price_name": None},
    "castor seed": {"canonical": "Castor seed", "yield_name": "Castor seed", "price_name": None},
    "coriander": {"canonical": "Coriander", "yield_name": "Coriander", "price_name": None},
    "cowpea(lobia)": {"canonical": "Cowpea(Lobia)", "yield_name": "Cowpea(Lobia)", "price_name": None},
    "dry chillies": {"canonical": "Dry chillies", "yield_name": "Dry chillies", "price_name": None},
    "garlic": {"canonical": "Garlic", "yield_name": "Garlic", "price_name": None},
    "gram": {"canonical": "Gram", "yield_name": "Gram", "price_name": None},
    "chickpea": {"canonical": "Gram", "yield_name": "Gram", "price_name": None},
    "horse-gram": {"canonical": "Horse-gram", "yield_name": "Horse-gram", "price_name": None},
    "linseed": {"canonical": "Linseed", "yield_name": "Linseed", "price_name": None},
    "moong(green gram)": {"canonical": "Moong(Green Gram)", "yield_name": "Moong(Green Gram)", "price_name": None},
    "niger seed": {"canonical": "Niger seed", "yield_name": "Niger seed", "price_name": None},
    "onion": {"canonical": "Onion", "yield_name": "Onion", "price_name": None},
    "other kharif pulses": {"canonical": "Other Kharif pulses", "yield_name": "Other Kharif pulses", "price_name": None},
    "other rabi pulses": {"canonical": "Other Rabi pulses", "yield_name": "Other Rabi pulses", "price_name": None},
    "peas & beans (pulses)": {"canonical": "Peas & beans (Pulses)", "yield_name": "Peas & beans (Pulses)", "price_name": None},
    "potato": {"canonical": "Potato", "yield_name": "Potato", "price_name": None},
    "rapeseed &mustard": {"canonical": "Rapeseed &Mustard", "yield_name": "Rapeseed &Mustard", "price_name": None},
    "safflower": {"canonical": "Safflower", "yield_name": "Safflower", "price_name": None},
    "sannhamp": {"canonical": "Sannhamp", "yield_name": "Sannhamp", "price_name": None},
    "sesamum": {"canonical": "Sesamum", "yield_name": "Sesamum", "price_name": None},
    "soyabean": {"canonical": "Soyabean", "yield_name": "Soyabean", "price_name": None},
    "sweet potato": {"canonical": "Sweet potato", "yield_name": "Sweet potato", "price_name": None},
    "tapioca": {"canonical": "Tapioca", "yield_name": "Tapioca", "price_name": None},
    "tobacco": {"canonical": "Tobacco", "yield_name": "Tobacco", "price_name": None},
    "urad": {"canonical": "Urad", "yield_name": "Urad", "price_name": None},
}


def predict_crop_plan(
    crop: str,
    district: str,
    season: Optional[str] = None,
    area_hectares: float = 1.0,
    year: Optional[int] = None,
    month: Optional[int] = None,
    prediction_date: Optional[str] = None,
    market: Optional[str] = None,
) -> Dict[str, Any]:
    """Unified prediction function returning both yield and market-price estimates.

    Parameters
    ----------
    crop : str
        Crop / commodity name (e.g., 'Rice', 'Maize', 'Sugarcane', 'Onion').
    district : str
        Karnataka agricultural district name (e.g., 'MYSURU', 'BELAGAVI').
    season : Optional[str], default=None
        Agricultural season ('Kharif', 'Rabi', 'Summer', 'Whole Year').
        If omitted but month is given, season is inferred automatically.
    area_hectares : float, default=1.0
        Cultivated land area in hectares (> 0).
    year : Optional[int], default=None
        Target planning year (e.g., 2024).
    month : Optional[int], default=None
        Target planning month (1 to 12).
    prediction_date : Optional[str], default=None
        Date string in 'YYYY-MM' or 'YYYY-MM-DD' format.
    market : Optional[str], default=None
        Target market or region (default operates on national monthly benchmarks).

    Returns
    -------
    dict
        Agreed JSON-serializable structure:
        - crop : str
        - district : str
        - season : str
        - year : int
        - month : int
        - area_hectares : float
        - predicted_yield_tonnes_per_hectare : Optional[float]
        - predicted_price_per_tonne : Optional[float]
        - predicted_price_per_quintal : Optional[float]
        - price_unit : Optional[str]
        - status : str ("success", "partial_success", "unsupported_price_unit")
        - limitations : List[str]

    Raises
    ------
    ValueError
        If inputs are missing, invalid, or reference an unsupported crop or district.
    """
    limitations: List[str] = []

    # 1. Validate Crop
    if not crop or not isinstance(crop, str) or not crop.strip():
        raise ValueError("Crop name cannot be empty or missing.")

    clean_crop_key = crop.strip().lower()
    mapping = CROP_ALIGNMENT.get(clean_crop_key)
    if not mapping:
        available = sorted(list(set(v["canonical"] for v in CROP_ALIGNMENT.values())))
        raise ValueError(
            f"Unsupported crop '{crop}'. The model does not support unseen crop categories. "
            f"Available crops include:\n" + ", ".join(available)
        )

    canonical_crop = mapping["canonical"]
    yield_crop = mapping["yield_name"]
    price_crop = mapping["price_name"]

    # 2. Validate District
    if not district or not isinstance(district, str) or not district.strip():
        raise ValueError("District cannot be empty or missing.")

    clean_dist = district.strip().upper()
    canonical_district = DISTRICT_MAPPING.get(clean_dist, clean_dist)
    if canonical_district not in SUPPORTED_DISTRICTS:
        raise ValueError(
            f"Unsupported district '{district}'. The system is specifically calibrated for "
            f"Karnataka's 30 agricultural districts and does not support out-of-region districts."
        )

    # 3. Parse and Validate Date (Year & Month)
    int_year = year
    int_month = month

    if prediction_date is not None:
        match = re.match(r"^(\d{4})[-/.](\d{1,2})", prediction_date.strip())
        if match:
            int_year = int(match.group(1))
            int_month = int(match.group(2))
        else:
            raise ValueError(f"Could not parse prediction_date '{prediction_date}'. Expected 'YYYY-MM'.")

    if int_year is None and int_month is None and season is None:
        raise ValueError("Date information missing. Provide 'year' and either 'month' or 'season'.")

    # If year is missing but prediction_date provided, handled above. Otherwise error:
    if int_year is None:
        raise ValueError("Year must be specified (e.g. year=2024).")

    # 4. Harmonize Season and Month
    canonical_season = season
    if canonical_season is None and int_month is not None:
        if canonical_crop == "Sugarcane":
            canonical_season = "Whole Year"
        elif int_month in [6, 7, 8, 9, 10]:
            canonical_season = "Kharif"
        elif int_month in [11, 12, 1, 2, 3]:
            canonical_season = "Rabi"
        else:
            canonical_season = "Summer"

    if int_month is None and canonical_season is not None:
        season_month_map = {"Kharif": 10, "Rabi": 2, "Summer": 5, "Whole Year": 12}
        int_month = season_month_map.get(canonical_season, 10)

    # 5. Predict Yield
    predicted_yield: Optional[float] = None
    if yield_crop is not None:
        try:
            yield_out = predict_yield(
                crop=yield_crop,
                district=canonical_district,
                season=canonical_season,
                area_hectares=area_hectares,
                year=int_year,
            )
            predicted_yield = yield_out["predicted_yield_tonnes_per_hectare"]
            limitations.extend(yield_out.get("limitations", []))
        except Exception as e:
            limitations.append(f"Yield prediction error: {str(e)}")
    else:
        limitations.append(
            f"Yield prediction unavailable: Crop '{canonical_crop}' was excluded from the Karnataka yield training dataset (non-tonne reporting units: bales/nuts)."
        )

    # 6. Predict Price
    predicted_price_tonne: Optional[float] = None
    predicted_price_quintal: Optional[float] = None
    price_unit: Optional[str] = None
    price_status: str = "success"

    if price_crop is not None:
        try:
            price_out = predict_price(
                crop=price_crop,
                year=int_year,
                month=int_month,
                market=market,
            )
            predicted_price_tonne = price_out["predicted_price_per_tonne"]
            predicted_price_quintal = price_out["predicted_price_per_quintal"]
            price_unit = price_out["price_unit"]
            price_status = price_out["status"]
            limitations.extend(price_out.get("limitations", []))
        except Exception as e:
            price_status = "error"
            limitations.append(f"Market price prediction error: {str(e)}")
    else:
        price_status = "unsupported_price_commodity"
        limitations.append(
            f"Market price prediction unavailable: Crop '{canonical_crop}' is not covered by the national market price commodities."
        )

    # 7. Overall Status Determination
    if predicted_yield is not None and predicted_price_tonne is not None:
        overall_status = "success"
    elif price_status == "unsupported_price_unit":
        overall_status = "unsupported_price_unit"
    elif predicted_yield is not None or predicted_price_tonne is not None:
        overall_status = "partial_success"
    else:
        overall_status = "error"

    # De-duplicate limitations while preserving order
    dedup_limitations = list(dict.fromkeys(limitations))

    return {
        "crop": canonical_crop.lower(),
        "district": canonical_district,
        "season": canonical_season,
        "year": int_year,
        "month": int_month,
        "area_hectares": float(area_hectares),
        "predicted_yield_tonnes_per_hectare": predicted_yield,
        "predicted_price_per_tonne": predicted_price_tonne,
        "predicted_price_per_quintal": predicted_price_quintal,
        "price_unit": price_unit,
        "status": overall_status,
        "limitations": dedup_limitations,
    }


# Convenience aliases
predict_crop_metrics = predict_crop_plan
get_crop_prediction = predict_crop_plan

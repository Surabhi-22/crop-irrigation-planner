
"""Profit calculations for the Crop & Irrigation Planner.

Units:
- Yield: tonnes per hectare
- Price: INR per tonne
- Area: hectares
- Cultivation cost: INR per hectare
- Revenue and profit: INR
"""

import math
from typing import Any, Dict, Optional


def calculate_crop_economics(
    crop: str,
    area_hectares: float,
    predicted_yield_tonnes_per_hectare: Optional[float],
    predicted_price_per_tonne: Optional[float],
    cultivation_cost_inr_per_hectare: float,
) -> Dict[str, Any]:
    """Calculate expected revenue and net profit for one plot-crop option.

    Returns an unavailable status if yield or price is missing.
    Costs are assumed to be per hectare for the entire planning period.
    """

    if not crop or not isinstance(crop, str):
        raise ValueError("crop must be a non-empty string")

    numeric_values = {
        "area_hectares": area_hectares,
        "cultivation_cost_inr_per_hectare":
            cultivation_cost_inr_per_hectare,
    }

    for name, value in numeric_values.items():
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError(f"{name} must be numeric")
        if not math.isfinite(value):
            raise ValueError(f"{name} must be finite")

    if area_hectares <= 0:
        raise ValueError("area_hectares must be greater than zero")

    if cultivation_cost_inr_per_hectare < 0:
        raise ValueError("cultivation cost cannot be negative")

    if predicted_yield_tonnes_per_hectare is None:
        return {
            "crop": crop,
            "status": "unavailable",
            "reason": "yield_prediction_missing",
            "revenue_inr": None,
            "cultivation_cost_inr": None,
            "expected_profit_inr": None,
        }

    if predicted_price_per_tonne is None:
        return {
            "crop": crop,
            "status": "unavailable",
            "reason": "price_prediction_missing",
            "revenue_inr": None,
            "cultivation_cost_inr": None,
            "expected_profit_inr": None,
        }

    for name, value in {
        "predicted_yield_tonnes_per_hectare":
            predicted_yield_tonnes_per_hectare,
        "predicted_price_per_tonne": predicted_price_per_tonne,
    }.items():
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError(f"{name} must be numeric or None")
        if not math.isfinite(value) or value < 0:
            raise ValueError(f"{name} must be finite and non-negative")

    production_tonnes = (
        predicted_yield_tonnes_per_hectare * area_hectares
    )
    revenue_inr = production_tonnes * predicted_price_per_tonne
    cultivation_cost_inr = (
        cultivation_cost_inr_per_hectare * area_hectares
    )
    expected_profit_inr = revenue_inr - cultivation_cost_inr

    return {
        "crop": crop,
        "status": "success",
        "production_tonnes": production_tonnes,
        "revenue_inr": revenue_inr,
        "cultivation_cost_inr": cultivation_cost_inr,
        "expected_profit_inr": expected_profit_inr,
    }

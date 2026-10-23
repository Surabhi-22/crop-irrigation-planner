"""Adapter connecting Member 1's ML prediction service to Member 2."""

from ml import predict_crop_plan
from optimizer.objective import calculate_crop_economics


def prepare_crop_option(
    plot_id,
    crop,
    district,
    season,
    area_hectares,
    cultivation_cost_inr_per_hectare,
    irrigation_requirement_mm,
    year=None,
    month=None,
    prediction_date=None,
    market=None,
):
    """Create one optimizer option from a real ML prediction.

    irrigation_requirement_mm must be the net irrigation requirement
    for the same planning period represented by the water budget.
    """

    if (
        isinstance(area_hectares, bool)
        or not isinstance(area_hectares, (int, float))
        or area_hectares <= 0
    ):
        raise ValueError("area_hectares must be positive")

    if (
        isinstance(irrigation_requirement_mm, bool)
        or not isinstance(irrigation_requirement_mm, (int, float))
        or irrigation_requirement_mm < 0
    ):
        raise ValueError("irrigation_requirement_mm must be non-negative")

    prediction = predict_crop_plan(
        crop=crop,
        district=district,
        season=season,
        area_hectares=area_hectares,
        year=year,
        month=month,
        prediction_date=prediction_date,
        market=market,
    )

    yield_value = prediction.get("predicted_yield_tonnes_per_hectare")
    price_value = prediction.get("predicted_price_per_tonne")

    economics = calculate_crop_economics(
        crop=crop,
        area_hectares=area_hectares,
        predicted_yield_tonnes_per_hectare=yield_value,
        predicted_price_per_tonne=price_value,
        cultivation_cost_inr_per_hectare=cultivation_cost_inr_per_hectare,
    )

    if economics.get("status") != "success":
        return {
            "status": "unavailable",
            "plot_id": plot_id,
            "crop": crop,
            "prediction_status": prediction.get("status"),
            "prediction_limitations": prediction.get("limitations", []),
            "economics": economics,
            "reason": "Required yield or price prediction is unavailable.",
        }

    water_required_m3 = (
        float(area_hectares) * float(irrigation_requirement_mm) * 10.0
    )

    return {
        "status": "success",
        "plot_id": plot_id,
        "crop": crop,
        "expected_profit_inr": economics["expected_profit_inr"],
        "water_required_m3": water_required_m3,
        "production_tonnes": economics["production_tonnes"],
        "revenue_inr": economics["revenue_inr"],
        "cultivation_cost_inr": economics["cultivation_cost_inr"],
        "predicted_yield_tonnes_per_hectare": yield_value,
        "predicted_price_per_tonne": price_value,
        "prediction_status": prediction.get("status"),
        "prediction_limitations": prediction.get("limitations", []),
        "price_unit": prediction.get("price_unit"),
    }

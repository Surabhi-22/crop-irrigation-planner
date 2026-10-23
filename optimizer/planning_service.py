"""Coordinate crop optimization and independent feasibility validation."""

from optimizer.constraints import validate_planning_inputs
from optimizer.crop_optimizer import optimize_crop_plan
from optimizer.feasibility_checker import validate_crop_plan


def create_crop_plan(plots, options, available_water_m3, allowed_crops):
    """Validate inputs, optimize crop selection, and verify the result.

    Parameters:
        plots: List of plot dictionaries containing plot_id,
               area_hectares, and candidates.
        options: Prepared crop options containing plot_id, crop,
                 expected_profit_inr, and water_required_m3.
        available_water_m3: Water available for the planning period.
        allowed_crops: Crop names permitted in the plan.

    Returns:
        A dictionary containing the planning result and validation report.

    Note:
        Options must be prepared using valid predictions, cultivation
        costs, and irrigation requirements. This function does not
        fabricate missing predictions.
    """

    input_report = validate_planning_inputs(
        plots=plots,
        available_water_m3=available_water_m3,
        allowed_crops=allowed_crops,
    )

    for plot in plots:
        for crop in plot["candidates"]:
            if crop.strip().casefold() not in {
                name.strip().casefold() for name in allowed_crops
            }:
                raise ValueError(
                    f"Crop {crop} on plot {plot['plot_id']} "
                    "is not in allowed_crops"
                )

    optimization = optimize_crop_plan(
        plots=plots,
        options=options,
        available_water_m3=available_water_m3,
    )

    if optimization["status"] != "success":
        return {
            "status": optimization["status"],
            "input_validation": input_report,
            "optimization": optimization,
            "feasibility": None,
        }

    feasibility = validate_crop_plan(
        plots=plots,
        selected_crops=optimization["selected_crops"],
        available_water_m3=available_water_m3,
    )

    if feasibility["status"] != "valid":
        return {
            "status": "validation_failed",
            "input_validation": input_report,
            "optimization": optimization,
            "feasibility": feasibility,
        }

    return {
        "status": "success",
        "input_validation": input_report,
        "optimization": optimization,
        "feasibility": feasibility,
    }

def create_predicted_crop_plan(
    plots,
    crop_inputs,
    district,
    season,
    available_water_m3,
    allowed_crops,
    year=None,
    month=None,
    prediction_date=None,
    market=None,
):
    """Create a crop plan using ML predictions and validate the result."""

    from optimizer.prediction_adapter import prepare_crop_option

    if not isinstance(crop_inputs, dict):
        raise ValueError("crop_inputs must be a dictionary")

    if not isinstance(allowed_crops, list) or not allowed_crops:
        raise ValueError("allowed_crops must be a non-empty list")

    options = []
    unavailable_options = []
    prepared_plots = []

    for plot in plots:
        plot_id = plot["plot_id"]
        area = plot["area_hectares"]
        valid_candidates = []

        for crop in plot["candidates"]:
            crop_data = next(
                (
                    value
                    for name, value in crop_inputs.items()
                    if isinstance(name, str)
                    and name.strip().casefold() == crop.strip().casefold()
                ),
                None,
            )

            if not isinstance(crop_data, dict):
                unavailable_options.append({
                    "plot_id": plot_id,
                    "crop": crop,
                    "reason": "Crop cost or irrigation input is missing.",
                })
                continue

            try:
                option = prepare_crop_option(
                    plot_id=plot_id,
                    crop=crop,
                    district=district,
                    season=season,
                    area_hectares=area,
                    cultivation_cost_inr_per_hectare=(
                        crop_data.get("cultivation_cost_inr_per_hectare")
                    ),
                    irrigation_requirement_mm=(
                        crop_data.get("irrigation_requirement_mm")
                    ),
                    year=year,
                    month=month,
                    prediction_date=prediction_date,
                    market=market,
                )
            except (ValueError, TypeError) as exc:
                unavailable_options.append({
                    "plot_id": plot_id,
                    "crop": crop,
                    "reason": str(exc),
                })
                continue

            if option.get("status") != "success":
                unavailable_options.append({
                    "plot_id": plot_id,
                    "crop": crop,
                    "reason": option.get(
                        "reason", "Required prediction is unavailable."
                    ),
                    "prediction_status": option.get("prediction_status"),
                })
                continue

            options.append(option)
            valid_candidates.append(crop)

        if not valid_candidates:
            return {
                "status": "unavailable",
                "message": (
                    f"No crop with complete prediction and farm inputs "
                    f"is available for plot {plot_id}."
                ),
                "unavailable_options": unavailable_options,
            }

        prepared_plots.append({
            "plot_id": plot_id,
            "area_hectares": area,
            "candidates": valid_candidates,
        })

    result = create_crop_plan(
        plots=prepared_plots,
        options=options,
        available_water_m3=available_water_m3,
        allowed_crops=allowed_crops,
    )

    result["unavailable_options"] = unavailable_options
    result["district"] = district
    result["season"] = season
    result["prediction_year"] = year
    result["prediction_month"] = month
    result["prediction_date"] = prediction_date
    result["market"] = market

    return result

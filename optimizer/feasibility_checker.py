"""Independent validation of a crop optimization plan."""

import math


def validate_crop_plan(plots, selected_crops, available_water_m3):
    """Check plot assignments, crop eligibility, profit, and water usage."""

    if not isinstance(plots, list) or not plots:
        raise ValueError("plots must be a non-empty list")

    if not isinstance(selected_crops, list):
        raise ValueError("selected_crops must be a list")

    if (
        isinstance(available_water_m3, bool)
        or not isinstance(available_water_m3, (int, float))
        or not math.isfinite(available_water_m3)
        or available_water_m3 < 0
    ):
        raise ValueError("available_water_m3 must be finite and non-negative")

    plot_map = {}

    for plot in plots:
        if not isinstance(plot, dict):
            raise ValueError("Each plot must be a dictionary")

        plot_id = plot.get("plot_id")
        candidates = plot.get("candidates")

        if not isinstance(plot_id, str) or not plot_id.strip():
            raise ValueError("Every plot needs a valid plot_id")

        if plot_id in plot_map:
            raise ValueError(f"Duplicate plot ID: {plot_id}")

        if not isinstance(candidates, list) or not candidates:
            raise ValueError(f"Plot {plot_id} needs candidate crops")

        if any(not isinstance(c, str) or not c.strip() for c in candidates):
            raise ValueError(f"Plot {plot_id} has an invalid candidate crop")

        normalized = [c.strip().casefold() for c in candidates]

        if len(normalized) != len(set(normalized)):
            raise ValueError(f"Plot {plot_id} has duplicate candidates")

        plot_map[plot_id] = set(normalized)

    selected_by_plot = {}
    total_profit = 0.0
    total_water = 0.0

    for item in selected_crops:
        if not isinstance(item, dict):
            raise ValueError("Every selected crop must be a dictionary")

        plot_id = item.get("plot_id")
        crop = item.get("crop")
        profit = item.get("expected_profit_inr")
        water = item.get("water_required_m3")

        if plot_id not in plot_map:
            raise ValueError(f"Unknown selected plot: {plot_id}")

        if plot_id in selected_by_plot:
            raise ValueError(f"More than one crop selected for plot {plot_id}")

        if not isinstance(crop, str) or not crop.strip():
            raise ValueError(f"Invalid crop for plot {plot_id}")

        if crop.strip().casefold() not in plot_map[plot_id]:
            raise ValueError(f"{crop} is not allowed for plot {plot_id}")

        for field, value in (
            ("expected_profit_inr", profit),
            ("water_required_m3", water),
        ):
            if (
                isinstance(value, bool)
                or not isinstance(value, (int, float))
                or not math.isfinite(value)
            ):
                raise ValueError(f"{field} must be a finite number")

        if water < 0:
            raise ValueError("Water requirement cannot be negative")

        selected_by_plot[plot_id] = crop.strip()
        total_profit += float(profit)
        total_water += float(water)

    missing_plots = sorted(set(plot_map) - set(selected_by_plot))

    if missing_plots:
        return {
            "status": "invalid",
            "errors": [f"No crop selected for plots: {missing_plots}"],
        }

    errors = []

    if total_water > available_water_m3 + 1e-7:
        errors.append("Total water requirement exceeds available water")

    if errors:
        return {
            "status": "invalid",
            "errors": errors,
            "total_water_required_m3": round(total_water, 2),
            "available_water_m3": float(available_water_m3),
        }

    return {
        "status": "valid",
        "plots_checked": len(plot_map),
        "selected_crops": selected_by_plot,
        "total_expected_profit_inr": round(total_profit, 2),
        "total_water_required_m3": round(total_water, 2),
        "available_water_m3": float(available_water_m3),
        "remaining_water_m3": round(
            float(available_water_m3) - total_water, 2
        ),
        "checks_passed": [
            "one_crop_per_plot",
            "crop_eligibility",
            "finite_profit_and_water_values",
            "non_negative_water_requirements",
            "water_budget",
        ],
    }

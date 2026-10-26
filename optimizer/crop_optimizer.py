"""Water-aware crop selection using SciPy mixed-integer optimization."""

import math
import numpy as np
from scipy.optimize import Bounds, LinearConstraint, milp


def optimize_crop_plan(plots, options, available_water_m3):
    """Maximize expected profit while respecting the water budget."""

    if not isinstance(plots, list) or not plots:
        raise ValueError("plots must be a non-empty list")

    if not isinstance(options, list) or not options:
        raise ValueError("options must be a non-empty list")

    if (
        isinstance(available_water_m3, bool)
        or not isinstance(available_water_m3, (int, float))
        or not math.isfinite(available_water_m3)
        or available_water_m3 < 0
    ):
        raise ValueError("Water budget must be finite and non-negative")

    plot_ids = []
    candidates = {}

    for plot in plots:
        if not isinstance(plot, dict):
            raise ValueError("Each plot must be a dictionary")

        plot_id = plot.get("plot_id")
        crops = plot.get("candidates")

        if not isinstance(plot_id, str) or not plot_id.strip():
            raise ValueError("Every plot needs a valid plot_id")

        if plot_id in plot_ids:
            raise ValueError(f"Duplicate plot ID: {plot_id}")

        if not isinstance(crops, list) or not crops:
            raise ValueError(f"Plot {plot_id} needs candidate crops")

        normalized = []
        for crop in crops:
            if not isinstance(crop, str) or not crop.strip():
                raise ValueError(f"Invalid crop on plot {plot_id}")
            normalized.append(crop.strip().casefold())

        if len(normalized) != len(set(normalized)):
            raise ValueError(f"Duplicate crop on plot {plot_id}")

        plot_ids.append(plot_id)
        candidates[plot_id] = set(normalized)

    decisions = []
    seen = set()

    for option in options:
        if not isinstance(option, dict):
            raise ValueError("Each option must be a dictionary")

        plot_id = option.get("plot_id")
        crop = option.get("crop")
        profit = option.get("expected_profit_inr")
        water = option.get("water_required_m3")

        if plot_id not in candidates:
            raise ValueError(f"Unknown plot: {plot_id}")

        if not isinstance(crop, str) or not crop.strip():
            raise ValueError("Every option needs a crop name")

        crop = crop.strip()

        if crop.casefold() not in candidates[plot_id]:
            raise ValueError(f"{crop} is not a candidate for {plot_id}")

        for name, value in (
            ("expected_profit_inr", profit),
            ("water_required_m3", water),
        ):
            if (
                isinstance(value, bool)
                or not isinstance(value, (int, float))
                or not math.isfinite(value)
            ):
                raise ValueError(f"{name} must be a finite number")

        if water < 0:
            raise ValueError("Water requirement cannot be negative")

        key = (plot_id, crop.casefold())
        if key in seen:
            raise ValueError(f"Duplicate option: {plot_id}, {crop}")
        seen.add(key)

        decisions.append({
            "plot_id": plot_id,
            "crop": crop,
            "expected_profit_inr": float(profit),
            "water_required_m3": float(water),
        })

    for plot_id in plot_ids:
        available_crops = {
            item["crop"].casefold()
            for item in decisions
            if item["plot_id"] == plot_id
        }

        if available_crops != candidates[plot_id]:
            raise ValueError(
                f"Every candidate for {plot_id} needs a valid option"
            )

    n = len(decisions)
    objective = -np.array(
        [item["expected_profit_inr"] for item in decisions],
        dtype=float,
    )

    matrix = np.zeros((len(plot_ids) + 1, n))

    for j, item in enumerate(decisions):
        matrix[plot_ids.index(item["plot_id"]), j] = 1
        matrix[-1, j] = item["water_required_m3"]

    lower = np.zeros(len(plot_ids) + 1)
    upper = np.full(len(plot_ids) + 1, np.inf)

    lower[:-1] = 1
    upper[:-1] = 1
    upper[-1] = available_water_m3

    result = milp(
        c=objective,
        integrality=np.ones(n),
        bounds=Bounds(np.zeros(n), np.ones(n)),
        constraints=LinearConstraint(matrix, lower, upper),
    )

    if result.status == 2:
        return {
            "status": "infeasible",
            "message": "No crop assignment satisfies the water budget.",
        }

    if not result.success or result.x is None:
        return {
            "status": "error",
            "message": str(result.message),
        }

    selected = [
        decisions[i] for i, value in enumerate(result.x) if value > 0.5
    ]

    if len(selected) != len(plot_ids):
        return {
            "status": "error",
            "message": "Incomplete crop assignment returned.",
        }

    total_profit = sum(x["expected_profit_inr"] for x in selected)
    total_water = sum(x["water_required_m3"] for x in selected)

    return {
        "status": "success",
        "selected_crops": selected,
        "total_expected_profit_inr": round(total_profit, 2),
        "total_water_required_m3": round(total_water, 2),
        "available_water_m3": float(available_water_m3),
        "remaining_water_m3": round(available_water_m3 - total_water, 2),
        "plots_planned": len(selected),
        "optimization_method": "SciPy mixed-integer linear optimization",
        "note": "Estimated profit is not guaranteed actual farm income.",
    }

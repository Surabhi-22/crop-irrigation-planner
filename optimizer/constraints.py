
"""Planning constraints for the Crop & Irrigation Planner."""

import math
from typing import Any, Dict, List, Set


def validate_planning_inputs(
    plots: List[Dict[str, Any]],
    available_water_m3: float,
    allowed_crops: List[str],
) -> Dict[str, Any]:
    """Validate the farm inputs before running optimization.

    Each plot must contain:
        plot_id: unique string
        area_hectares: positive number
        candidates: list of permitted crop names

    Each candidate crop must be included in allowed_crops.
    """

    if not isinstance(plots, list) or not plots:
        raise ValueError("plots must be a non-empty list")

    if not isinstance(allowed_crops, list) or not allowed_crops:
        raise ValueError("allowed_crops must be a non-empty list")

    if (
        isinstance(available_water_m3, bool)
        or not isinstance(available_water_m3, (int, float))
        or not math.isfinite(available_water_m3)
        or available_water_m3 < 0
    ):
        raise ValueError(
            "available_water_m3 must be finite and non-negative"
        )

    allowed: Set[str] = set()

    for crop in allowed_crops:
        if not isinstance(crop, str) or not crop.strip():
            raise ValueError("Every allowed crop must have a valid name")
        allowed.add(crop.strip().casefold())

    if len(allowed) != len(allowed_crops):
        raise ValueError("allowed_crops must not contain duplicate names")

    seen_plot_ids: Set[str] = set()

    for plot in plots:
        if not isinstance(plot, dict):
            raise ValueError("Every plot must be a dictionary")

        plot_id = plot.get("plot_id")
        if not isinstance(plot_id, str) or not plot_id.strip():
            raise ValueError("Every plot must have a non-empty plot_id")

        if plot_id in seen_plot_ids:
            raise ValueError(f"Duplicate plot_id: {plot_id}")
        seen_plot_ids.add(plot_id)

        area = plot.get("area_hectares")
        if (
            isinstance(area, bool)
            or not isinstance(area, (int, float))
            or not math.isfinite(area)
            or area <= 0
        ):
            raise ValueError(
                f"Plot {plot_id}: area_hectares must be finite and positive"
            )

        candidates = plot.get("candidates")
        if not isinstance(candidates, list) or not candidates:
            raise ValueError(
                f"Plot {plot_id}: candidates must be a non-empty list"
            )

        normalized_candidates = []

        for crop in candidates:
            if not isinstance(crop, str) or not crop.strip():
                raise ValueError(
                    f"Plot {plot_id}: every candidate must have a valid name"
                )

            normalized = crop.strip().casefold()

            if normalized not in allowed:
                raise ValueError(
                    f"Crop '{crop}' on plot {plot_id} "
                    "is not in allowed_crops"
                )

            if normalized in normalized_candidates:
                raise ValueError(
                    f"Plot {plot_id}: duplicate candidate crop '{crop}'"
                )

            normalized_candidates.append(normalized)

    return {
        "status": "valid",
        "plot_count": len(plots),
        "allowed_crop_count": len(allowed),
        "available_water_m3": float(available_water_m3),
        "constraints_checked": [
            "non_empty_plots",
            "unique_plot_ids",
            "positive_plot_areas",
            "valid_candidate_crops",
            "non_negative_water_budget",
        ],
    }

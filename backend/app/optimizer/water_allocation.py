
"""Water calculations for the Crop & Irrigation Planner.

Units:
- Plot area: hectares
- Irrigation requirement: millimetres per planning period
- Water volume: cubic metres (m3)
"""

import math
from typing import Any, Dict, List


def calculate_plot_water(
    plot_id: str,
    crop: str,
    area_hectares: float,
    irrigation_requirement_mm: float,
) -> Dict[str, Any]:
    """Calculate irrigation water volume for one plot.

    One millimetre of water over one hectare equals 10 cubic metres.
    The irrigation requirement must represent the same planning period
    used by the farm's available-water budget.
    """

    if not isinstance(plot_id, str) or not plot_id.strip():
        raise ValueError("plot_id must be a non-empty string")

    if not isinstance(crop, str) or not crop.strip():
        raise ValueError("crop must be a non-empty string")

    for name, value in {
        "area_hectares": area_hectares,
        "irrigation_requirement_mm": irrigation_requirement_mm,
    }.items():
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError(f"{name} must be numeric")
        if not math.isfinite(value):
            raise ValueError(f"{name} must be finite")
        if value < 0:
            raise ValueError(f"{name} cannot be negative")

    if area_hectares == 0:
        raise ValueError("area_hectares must be greater than zero")

    water_m3 = area_hectares * irrigation_requirement_mm * 10

    return {
        "plot_id": plot_id,
        "crop": crop,
        "area_hectares": float(area_hectares),
        "irrigation_requirement_mm": float(irrigation_requirement_mm),
        "water_required_m3": water_m3,
    }


def summarize_water_allocation(
    allocations: List[Dict[str, Any]],
    available_water_m3: float,
) -> Dict[str, Any]:
    """Summarize water use and check the available-water constraint."""

    if isinstance(available_water_m3, bool) or not isinstance(
        available_water_m3, (int, float)
    ):
        raise ValueError("available_water_m3 must be numeric")

    if not math.isfinite(available_water_m3) or available_water_m3 < 0:
        raise ValueError("available_water_m3 must be finite and non-negative")

    total_water_m3 = 0.0

    for allocation in allocations:
        if "water_required_m3" not in allocation:
            raise ValueError("Every allocation must contain water_required_m3")

        water = allocation["water_required_m3"]

        if isinstance(water, bool) or not isinstance(water, (int, float)):
            raise ValueError("water_required_m3 must be numeric")

        if not math.isfinite(water) or water < 0:
            raise ValueError("water_required_m3 must be finite and non-negative")

        total_water_m3 += water

    remaining_water_m3 = available_water_m3 - total_water_m3

    return {
        "total_water_required_m3": total_water_m3,
        "available_water_m3": float(available_water_m3),
        "remaining_water_m3": remaining_water_m3,
        "water_feasible": remaining_water_m3 >= -1e-9,
    }

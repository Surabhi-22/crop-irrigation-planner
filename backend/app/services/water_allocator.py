"""
Water allocator — computes water balances and irrigation requirements.

Key design principles:
1. Alternative candidate crops are mutually exclusive scenario options for the farm area.
   Their full-farm water demands MUST NEVER be summed together as actual consumption.
2. The primary water balance is calculated for the selected recommendation (or a user-selected crop).
3. Candidate crops are individually compared against the farm's irrigation supply,
   reporting separate requirement, surplus/deficit, and feasibility for each option.
4. Irrigation methods (Drip 90%, Sprinkler 75%, Surface/Flood 55% baseline) are evaluated
   using gross withdrawal = net_irrigation / efficiency, calculating water savings
   against the Surface/Flood baseline.
5. If multi-crop areas are provided, demands are computed using each crop's respective planted area.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from app.services.crop_selector import FeasibleCrop
from app.services.crop_data import MM_PER_ACRE_TO_M3


# ---------------------------------------------------------------------------
# Constants & Defaults
# ---------------------------------------------------------------------------

DEFAULT_IRRIGATION_EFFICIENCIES: Dict[str, float] = {
    "Drip": 0.90,          # 90% application efficiency
    "Sprinkler": 0.75,     # 75% application efficiency
    "Surface/Flood": 0.55, # 55% application efficiency (standard baseline)
}
BASELINE_METHOD = "Surface/Flood"


# ---------------------------------------------------------------------------
# Data Classes
# ---------------------------------------------------------------------------

@dataclass
class AllocatedCrop:
    """A feasible crop that has been confirmed within the water budget."""

    crop: FeasibleCrop
    allocated_water_m3: float  # irrigation water earmarked for this crop


@dataclass
class CandidateCropWaterDemand:
    """Irrigation demand analysis for a single candidate crop on the farm."""

    crop_name: str
    water_req_mm: float
    effective_irrigation_mm: float
    irrigation_req_m3: float
    available_water_m3: float
    allocated_m3: float
    remaining_m3: float
    deficit_m3: float
    surplus_m3: float
    allocation_pct: float
    is_feasible: bool


@dataclass
class WaterAllocation:
    """Output of the water allocator for the selected plan."""

    selected_crop_name: str = ""
    total_available_m3: float = 0.0
    net_demand_m3: float = 0.0
    total_allocated_m3: float = 0.0
    remaining_m3: float = 0.0
    deficit_m3: float = 0.0
    surplus_m3: float = 0.0
    allocation_pct: float = 0.0
    candidate_demands: List[CandidateCropWaterDemand] = field(default_factory=list)
    irrigation_methods: List[Dict[str, Any]] = field(default_factory=list)

    # Backwards compatibility attributes
    allocated_crops: List[AllocatedCrop] = field(default_factory=list)
    skipped_crops: List[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Irrigation Method Comparison Calculator
# ---------------------------------------------------------------------------

def calculate_irrigation_method_comparisons(
    net_requirement_m3: float,
    available_water_m3: float,
    efficiencies: Optional[Dict[str, float]] = None,
    baseline_method: str = BASELINE_METHOD,
) -> List[Dict[str, Any]]:
    """
    Calculate gross irrigation withdrawal and water savings for Drip, Sprinkler,
    and Surface/Flood methods based on net crop requirement.

    Formulas:
      gross_withdrawal_m3 = net_crop_irrigation_requirement_m3 / efficiency_fraction
      baseline_gross_m3 = net_crop_irrigation_requirement_m3 / baseline_efficiency_fraction
      savings_m3 = max(0, baseline_gross_m3 - gross_withdrawal_m3)
      savings_pct = (savings_m3 / baseline_gross_m3) * 100

    Parameters
    ----------
    net_requirement_m3 : float
        Net seasonal supplemental irrigation needed by the crop (m³).
    available_water_m3 : float
        Available farm irrigation supply (m³).
    efficiencies : Optional[Dict[str, float]]
        Map of method name -> efficiency fraction (e.g. 0.90 for 90%).
    baseline_method : str
        Name of baseline comparison method (default: Surface/Flood).

    Returns
    -------
    List[Dict[str, Any]]
        List of method comparisons with gross withdrawal, savings, and status.
    """
    if isinstance(net_requirement_m3, bool) or not isinstance(net_requirement_m3, (int, float)):
        raise ValueError("net_requirement_m3 must be numeric")
    if not math.isfinite(net_requirement_m3) or net_requirement_m3 < 0:
        raise ValueError("net_requirement_m3 must be finite and non-negative")

    if isinstance(available_water_m3, bool) or not isinstance(available_water_m3, (int, float)):
        raise ValueError("available_water_m3 must be numeric")
    if not math.isfinite(available_water_m3) or available_water_m3 < 0:
        raise ValueError("available_water_m3 must be finite and non-negative")

    eff_map = dict(efficiencies or DEFAULT_IRRIGATION_EFFICIENCIES)

    # Validate and normalize efficiency fractions
    normalized_eff: Dict[str, float] = {}
    for name, raw_eff in eff_map.items():
        if isinstance(raw_eff, bool) or not isinstance(raw_eff, (int, float)):
            raise ValueError(f"Efficiency for '{name}' must be numeric")
        eff = float(raw_eff)
        if eff > 1.0 and eff <= 100.0:
            eff = eff / 100.0
        if not math.isfinite(eff) or eff <= 0.0 or eff > 1.0:
            raise ValueError(
                f"Efficiency for '{name}' must be > 0 and <= 1.0 (or <= 100%). Received: {raw_eff}"
            )
        normalized_eff[name] = eff

    if baseline_method not in normalized_eff:
        baseline_eff = DEFAULT_IRRIGATION_EFFICIENCIES.get(baseline_method, 0.55)
        normalized_eff[baseline_method] = baseline_eff
    else:
        baseline_eff = normalized_eff[baseline_method]

    baseline_gross = net_requirement_m3 / baseline_eff if net_requirement_m3 > 0 else 0.0

    comparisons: List[Dict[str, Any]] = []
    for method_name, eff in normalized_eff.items():
        is_base = method_name == baseline_method

        if net_requirement_m3 <= 0:
            gross = 0.0
            savings_m3 = 0.0
            savings_pct = 0.0
            status = "Rain-fed / No Irrigation Needed"
        else:
            gross = net_requirement_m3 / eff
            savings_m3 = max(0.0, baseline_gross - gross)
            savings_pct = (savings_m3 / baseline_gross * 100.0) if baseline_gross > 0 else 0.0
            if gross <= available_water_m3:
                status = "Sufficient Supply"
            else:
                deficit = gross - available_water_m3
                status = f"Deficit: requires +{deficit:,.0f} m³"

        comparisons.append({
            "method": method_name,
            "efficiency_pct": round(eff * 100.0, 1),
            "net_requirement_m3": round(net_requirement_m3, 2),
            "gross_withdrawal_m3": round(gross, 2),
            "savings_vs_baseline_m3": round(savings_m3, 2),
            "savings_pct": round(savings_pct, 1),
            "is_baseline": is_base,
            "feasibility_status": status,
        })

    return comparisons


# ---------------------------------------------------------------------------
# Multi-Crop Area Allocation Calculator
# ---------------------------------------------------------------------------

def allocate_multi_crop_water(
    crop_allocations: List[Dict[str, Any]],
    available_water_m3: float,
    expected_rainfall_mm: float = 0.0,
) -> Dict[str, Any]:
    """
    Calculate water requirements for multiple crops genuinely planted on separate areas.

    Parameters
    ----------
    crop_allocations : List[Dict[str, Any]]
        List of dicts with keys:
          - 'crop_name': str
          - 'area_acres': float (> 0)
          - 'water_req_mm': float (total seasonal crop requirement)
    available_water_m3 : float
        Available irrigation reserve (m³).
    expected_rainfall_mm : float
        Forecasted seasonal rainfall (mm).

    Returns
    -------
    Dict[str, Any]
        Multi-crop allocation summary with breakdown per planted area.
    """
    if isinstance(available_water_m3, bool) or not isinstance(available_water_m3, (int, float)):
        raise ValueError("available_water_m3 must be numeric")
    if available_water_m3 < 0:
        raise ValueError("available_water_m3 cannot be negative")

    if isinstance(expected_rainfall_mm, bool) or not isinstance(expected_rainfall_mm, (int, float)):
        raise ValueError("expected_rainfall_mm must be numeric")
    rainfall_mm = max(0.0, float(expected_rainfall_mm))

    crop_results = []
    total_area_acres = 0.0
    total_demand_m3 = 0.0

    for alloc in crop_allocations:
        crop_name = str(alloc.get("crop_name", "Unknown Crop")).strip()
        area = float(alloc.get("area_acres", 0.0))
        if area <= 0:
            raise ValueError(f"area_acres for '{crop_name}' must be greater than zero")

        water_req_mm = float(alloc.get("water_req_mm", 0.0))
        if water_req_mm < 0:
            raise ValueError(f"water_req_mm for '{crop_name}' cannot be negative")

        effective_mm = max(0.0, water_req_mm - rainfall_mm)
        demand_m3 = effective_mm * area * MM_PER_ACRE_TO_M3

        crop_results.append({
            "crop_name": crop_name,
            "area_acres": round(area, 2),
            "water_req_mm": round(water_req_mm, 1),
            "effective_irrigation_mm": round(effective_mm, 1),
            "irrigation_demand_m3": round(demand_m3, 2),
        })

        total_area_acres += area
        total_demand_m3 += demand_m3

    allocated_m3 = min(float(available_water_m3), total_demand_m3)
    remaining_m3 = max(0.0, float(available_water_m3) - total_demand_m3)
    deficit_m3 = max(0.0, total_demand_m3 - float(available_water_m3))
    surplus_m3 = max(0.0, float(available_water_m3) - total_demand_m3)
    pct = (allocated_m3 / available_water_m3 * 100.0) if available_water_m3 > 0 else (
        0.0 if total_demand_m3 == 0 else 100.0
    )

    return {
        "crop_allocations": crop_results,
        "total_area_acres": round(total_area_acres, 2),
        "total_demand_m3": round(total_demand_m3, 2),
        "total_available_m3": round(float(available_water_m3), 2),
        "allocated_m3": round(allocated_m3, 2),
        "remaining_m3": round(remaining_m3, 2),
        "deficit_m3": round(deficit_m3, 2),
        "surplus_m3": round(surplus_m3, 2),
        "allocation_pct": round(pct, 1),
        "water_feasible": deficit_m3 <= 1e-6,
    }


# ---------------------------------------------------------------------------
# Main Single-Plan Water Allocation
# ---------------------------------------------------------------------------

def allocate_water(
    feasible_crops: List[FeasibleCrop],
    available_water_m3: float,
    selected_crop_name: Optional[str] = None,
) -> WaterAllocation:
    """
    Perform water allocation for the selected crop scenario.

    Alternative crops are mutually exclusive candidate options for the full farm;
    their demands are NOT summed. The farm's active water balance is determined
    by the selected recommendation (or specified selected crop), while all
    candidate crops are individually analyzed.

    Parameters
    ----------
    feasible_crops : List[FeasibleCrop]
        Filtered and profit-ranked list from crop_selector.
    available_water_m3 : float
        Total irrigation reserve in m³.
    selected_crop_name : Optional[str]
        Optional name of specific crop to select; defaults to feasible_crops[0].

    Returns
    -------
    WaterAllocation
        Dataclass containing water totals, candidate comparisons, and method breakdowns.
    """
    available = max(0.0, float(available_water_m3))

    if not feasible_crops:
        methods = calculate_irrigation_method_comparisons(0.0, available)
        return WaterAllocation(
            total_available_m3=available,
            remaining_m3=available,
            surplus_m3=available,
            irrigation_methods=methods,
        )

    # 1. Determine selected crop
    selected_crop: FeasibleCrop = feasible_crops[0]
    if selected_crop_name:
        for c in feasible_crops:
            if c.name.strip().lower() == selected_crop_name.strip().lower():
                selected_crop = c
                break

    # 2. Compute water balance for the selected crop
    net_demand = max(0.0, selected_crop.irrigation_req_m3)
    allocated = min(available, net_demand)
    remaining = max(0.0, available - net_demand)
    deficit = max(0.0, net_demand - available)
    surplus = max(0.0, available - net_demand)
    pct = (allocated / available * 100.0) if available > 0 else (
        0.0 if net_demand == 0 else 100.0
    )

    # 3. Analyze each candidate crop separately
    candidate_demands: List[CandidateCropWaterDemand] = []
    skipped_crops: List[str] = []

    for crop in feasible_crops:
        c_demand = max(0.0, crop.irrigation_req_m3)
        c_allocated = min(available, c_demand)
        c_remaining = max(0.0, available - c_demand)
        c_deficit = max(0.0, c_demand - available)
        c_surplus = max(0.0, available - c_demand)
        c_pct = (c_allocated / available * 100.0) if available > 0 else (
            0.0 if c_demand == 0 else 100.0
        )
        is_feas = c_demand <= available

        if not is_feas:
            skipped_crops.append(crop.name)

        eff_mm = (
            c_demand / (crop.total_yield_tonnes / crop.yield_t_per_acre * MM_PER_ACRE_TO_M3)
            if crop.yield_t_per_acre > 0 and crop.total_yield_tonnes > 0
            else 0.0
        )

        candidate_demands.append(
            CandidateCropWaterDemand(
                crop_name=crop.name,
                water_req_mm=crop.water_req_mm,
                effective_irrigation_mm=round(eff_mm, 1),
                irrigation_req_m3=round(c_demand, 2),
                available_water_m3=round(available, 2),
                allocated_m3=round(c_allocated, 2),
                remaining_m3=round(c_remaining, 2),
                deficit_m3=round(c_deficit, 2),
                surplus_m3=round(c_surplus, 2),
                allocation_pct=round(c_pct, 1),
                is_feasible=is_feas,
            )
        )

    # 4. Compute irrigation method comparisons for the selected crop
    methods = calculate_irrigation_method_comparisons(net_demand, available)

    # 5. Backwards-compatibility allocated crops list
    allocated_crops = [
        AllocatedCrop(crop=selected_crop, allocated_water_m3=round(allocated, 2))
    ]

    return WaterAllocation(
        selected_crop_name=selected_crop.name,
        total_available_m3=round(available, 2),
        net_demand_m3=round(net_demand, 2),
        total_allocated_m3=round(allocated, 2),
        remaining_m3=round(remaining, 2),
        deficit_m3=round(deficit, 2),
        surplus_m3=round(surplus, 2),
        allocation_pct=round(pct, 1),
        candidate_demands=candidate_demands,
        irrigation_methods=methods,
        allocated_crops=allocated_crops,
        skipped_crops=skipped_crops,
    )

"""
Water allocator — distributes the available irrigation reserve across
a ranked list of feasible crops.

Strategy: greedy allocation in profit-rank order.
  - Each crop is assigned the irrigation it specifically needs.
  - If the remaining water is insufficient for a crop, that crop is skipped.
  - Crops that are rain-fed (irrigation_req_m3 = 0) are always included.

This avoids adding scipy / cvxpy as a dependency while still producing a
meaningful, deterministic allocation.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List

from app.services.crop_selector import FeasibleCrop


@dataclass
class AllocatedCrop:
    """A feasible crop that has been confirmed within the water budget."""

    crop: FeasibleCrop
    allocated_water_m3: float  # irrigation water earmarked for this crop


@dataclass
class WaterAllocation:
    """Output of the water allocator."""

    allocated_crops: List[AllocatedCrop] = field(default_factory=list)
    total_available_m3: float = 0.0
    total_allocated_m3: float = 0.0
    remaining_m3: float = 0.0
    skipped_crops: List[str] = field(default_factory=list)  # names only


def allocate_water(
    feasible_crops: List[FeasibleCrop],
    available_water_m3: float,
) -> WaterAllocation:
    """
    Perform greedy water allocation over profit-ranked feasible crops.

    Parameters
    ----------
    feasible_crops : List[FeasibleCrop]
        Already filtered and profit-sorted list from crop_selector.
    available_water_m3 : float
        Total irrigation reserve in m³.

    Returns
    -------
    WaterAllocation
        Dataclass containing allocated crops, water totals, and remainder.
    """
    result = WaterAllocation(
        total_available_m3=available_water_m3,
        remaining_m3=available_water_m3,
    )

    for crop in feasible_crops:
        needed = crop.irrigation_req_m3

        if needed <= result.remaining_m3:
            result.allocated_crops.append(
                AllocatedCrop(crop=crop, allocated_water_m3=needed)
            )
            result.total_allocated_m3 += needed
            result.remaining_m3 -= needed
        else:
            # This should not normally occur because crop_selector already
            # checked water feasibility per-crop — but guard anyway.
            result.skipped_crops.append(crop.name)

    return result

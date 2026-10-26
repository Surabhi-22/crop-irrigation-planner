"""Crop optimization package for the Crop & Irrigation Planner.

Exposes the main planning entry points:
- create_crop_plan (from optimizer.planning_service)
- create_predicted_crop_plan (from optimizer.planning_service)
"""

from optimizer.planning_service import create_crop_plan, create_predicted_crop_plan

__all__ = [
    "create_crop_plan",
    "create_predicted_crop_plan",
]

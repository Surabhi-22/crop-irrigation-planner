"""
Plan generation endpoint — POST /api/v1/plan/generate

Accepts farm parameters (same schema as /farm/validate), runs the agricultural
planning pipeline, and returns a structured crop plan.

Error handling:
  422 — InfeasiblePlanError:  No crop satisfies all constraints
  400 — ValueError:           Unexpected invalid input that slipped past Pydantic
  503 — Service unavailable:  Unexpected internal failure (logged server-side)
"""

import logging

from fastapi import APIRouter, HTTPException

from app.schemas.farm import FarmInput
from app.schemas.plan import CropPlanItem, PlanResponse, WaterSummary
from app.services.planning_service import (
    InfeasiblePlanError,
    PlanResult,
    generate_plan,
)
from app.services.crop_selector import FeasibleCrop

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Helper: convert internal FeasibleCrop → CropPlanItem schema
# ---------------------------------------------------------------------------


def _to_crop_plan_item(crop: FeasibleCrop) -> CropPlanItem:
    return CropPlanItem(
        name=crop.name,
        season=crop.season,
        duration_days=crop.duration_days,
        notes=crop.notes,
        water_req_mm=crop.water_req_mm,
        irrigation_req_m3=round(crop.irrigation_req_m3, 2),
        yield_t_per_acre=crop.yield_t_per_acre,
        price_inr_per_tonne=crop.price_inr_per_tonne,
        cost_inr_per_acre=crop.cost_inr_per_acre,
        est_total_yield_tonnes=round(crop.total_yield_tonnes, 3),
        est_total_revenue_inr=round(crop.total_revenue_inr, 2),
        est_total_cost_inr=round(crop.total_cost_inr, 2),
        est_total_profit_inr=round(crop.total_profit_inr, 2),
    )


# ---------------------------------------------------------------------------
# Helper: build WaterSummary from PlanResult
# ---------------------------------------------------------------------------


def _to_water_summary(result: PlanResult) -> WaterSummary:
    avail = result.total_available_water_m3
    allocated = result.water_allocation.total_allocated_m3
    pct = (allocated / avail * 100) if avail > 0 else 0.0
    return WaterSummary(
        total_available_m3=round(avail, 2),
        expected_rainfall_m3=round(result.expected_rainfall_m3, 2),
        allocated_m3=round(allocated, 2),
        remaining_m3=round(result.water_allocation.remaining_m3, 2),
        allocation_pct=round(pct, 1),
    )


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


@router.post(
    "/plan/generate",
    response_model=PlanResponse,
    summary="Generate Crop Plan",
    description=(
        "Accepts farm parameters and returns a ranked list of feasible crops "
        "with estimated yield, revenue, cost, profit, and water allocation. "
        "All figures are ICAR benchmark estimates — not live predictions."
    ),
    tags=["Planning"],
)
def generate_crop_plan(farm_input: FarmInput) -> PlanResponse:
    """
    Run the agricultural planning pipeline for the given farm.

    Returns an HTTP 422 with a structured infeasibility message when no crop
    can satisfy the season / soil / water / budget constraints.
    """
    try:
        result: PlanResult = generate_plan(
            area_acres=farm_input.area_acres,
            soil_type=farm_input.soil_type,
            expected_rainfall_mm=farm_input.expected_rainfall_mm,
            available_water_m3=farm_input.available_water_m3,
            location=farm_input.location,
            season=farm_input.season,
            budget_inr=farm_input.budget_inr,
        )

    except InfeasiblePlanError as exc:
        logger.info(
            "Infeasible plan for farm at %s (%s season): %s",
            farm_input.location,
            farm_input.season,
            exc.reason,
        )
        # Return 422 with a machine-readable infeasibility payload
        raise HTTPException(
            status_code=422,
            detail={
                "error": "infeasible_plan",
                "message": exc.reason,
                "suggestions": exc.suggestions,
                "farm": {
                    "area_acres": farm_input.area_acres,
                    "season": farm_input.season,
                    "soil_type": farm_input.soil_type,
                    "available_water_m3": farm_input.available_water_m3,
                    "budget_inr": farm_input.budget_inr,
                },
            },
        )

    except ValueError as exc:
        logger.warning("Invalid input reached plan endpoint: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc))

    except Exception as exc:
        # Do not leak internal details; log server-side
        logger.exception("Unexpected error in planning pipeline: %s", exc)
        raise HTTPException(
            status_code=503,
            detail=(
                "The planning service encountered an unexpected error. "
                "Please try again. If the problem persists contact support."
            ),
        )

    # ── Build PlanResponse ─────────────────────────────────────────────────
    top_item = _to_crop_plan_item(result.top_recommendation)
    all_items = [_to_crop_plan_item(c) for c in result.feasible_crops]
    water_summary = _to_water_summary(result)

    return PlanResponse(
        feasible=True,
        infeasibility_reason=None,
        infeasibility_suggestions=None,
        farm_area_acres=result.farm_area_acres,
        season=result.season,
        location=result.location,
        soil_type=result.soil_type,
        water=water_summary,
        top_recommendation=top_item,
        all_feasible_crops=all_items,
        planning_notes=result.planning_notes,
        data_source=result.data_source,
        disclaimer=result.disclaimer,
    )

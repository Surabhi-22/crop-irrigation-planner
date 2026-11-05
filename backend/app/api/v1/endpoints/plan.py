"""
Plan generation endpoint — POST /api/v1/plan/generate

Accepts farm parameters (same schema as /farm/validate), runs the agricultural
planning pipeline, and returns a structured crop plan.

Error handling:
  422 — InfeasiblePlanError:  No crop satisfies all constraints even on partial parcel
  400 — ValueError:           Unexpected invalid input that slipped past Pydantic
  503 — Service unavailable:  Unexpected internal failure (logged server-side)
"""

import logging

from fastapi import APIRouter, HTTPException

from app.schemas.farm import FarmInput
from app.schemas.plan import (
    AlternativeCropItem,
    CropPlanItem,
    CropWaterComparison,
    IrrigationMethodComparison,
    PlanResponse,
    UnsuitableCropItem,
    WaterSummary,
)
from app.services.planning_service import (
    InfeasiblePlanError,
    PlanResult,
    generate_plan,
)
from app.services.crop_selector import AlternativeCrop, FeasibleCrop, RejectedCrop

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
        recommended_area_acres=round(crop.cultivated_area_acres, 2),
        remaining_area_acres=round(crop.remaining_area_acres, 2),
        is_partial_area=crop.is_partial_area,
        limiting_factor=crop.limiting_factor,
        full_area_cost_inr=round(crop.full_area_cost_inr, 2),
        budget_gap_for_full_area_inr=round(crop.budget_gap_for_full_area_inr, 2),
        remaining_budget_inr=round(crop.remaining_budget_inr, 2),
        roi_pct=round(crop.roi_pct, 1),
        category=crop.category,
        suitability_reason=crop.suitability_reason,
    )


# ---------------------------------------------------------------------------
# Helper: convert AlternativeCrop → AlternativeCropItem schema
# ---------------------------------------------------------------------------


def _to_alternative_crop_item(alt: AlternativeCrop) -> AlternativeCropItem:
    return AlternativeCropItem(
        name=alt.name,
        season=alt.season,
        duration_days=alt.duration_days,
        notes=alt.notes,
        cost_inr_per_acre=round(alt.cost_inr_per_acre, 2),
        water_req_mm=round(alt.water_req_mm, 1),
        yield_t_per_acre=round(alt.yield_t_per_acre, 2),
        price_inr_per_tonne=round(alt.price_inr_per_tonne, 2),
        category=alt.category,
        required_adjustment=alt.required_adjustment,
        adjustment_type=alt.adjustment_type,
        full_area_cost_inr=round(alt.full_area_cost_inr, 2),
        budget_gap_inr=round(alt.budget_gap_inr, 2),
        water_gap_m3=round(alt.water_gap_m3, 2),
        alternative_season=alt.alternative_season,
        target_soil=alt.target_soil,
        why_alternative=alt.why_alternative,
    )


# ---------------------------------------------------------------------------
# Helper: convert RejectedCrop → UnsuitableCropItem schema
# ---------------------------------------------------------------------------


def _to_unsuitable_crop_item(rej: RejectedCrop) -> UnsuitableCropItem:
    return UnsuitableCropItem(
        name=rej.name,
        category=rej.category,
        rejection_reasons=rej.rejection_reasons,
        notes=rej.notes,
    )


# ---------------------------------------------------------------------------
# Helper: build WaterSummary from PlanResult
# ---------------------------------------------------------------------------


def _to_water_summary(result: PlanResult) -> WaterSummary:
    alloc = result.water_allocation
    avail = result.total_available_water_m3
    allocated = alloc.total_allocated_m3
    pct = alloc.allocation_pct

    # Format candidate crop comparisons
    candidates = [
        CropWaterComparison(
            name=c.crop_name,
            water_req_mm=round(c.water_req_mm, 1),
            irrigation_req_m3=round(c.irrigation_req_m3, 2),
            available_supply_m3=round(c.available_water_m3, 2),
            allocated_m3=round(c.allocated_m3, 2),
            remaining_m3=round(c.remaining_m3, 2),
            deficit_m3=round(c.deficit_m3, 2),
            surplus_m3=round(c.surplus_m3, 2),
            allocation_pct=round(c.allocation_pct, 1),
            is_feasible=c.is_feasible,
        )
        for c in alloc.candidate_demands
    ]

    # Format irrigation method comparisons
    methods = [
        IrrigationMethodComparison(
            method=m["method"],
            efficiency_pct=float(m["efficiency_pct"]),
            net_requirement_m3=float(m["net_requirement_m3"]),
            gross_withdrawal_m3=float(m["gross_withdrawal_m3"]),
            savings_vs_baseline_m3=float(m["savings_vs_baseline_m3"]),
            savings_pct=float(m["savings_pct"]),
            is_baseline=bool(m.get("is_baseline", False)),
            feasibility_status=str(m["feasibility_status"]),
        )
        for m in alloc.irrigation_methods
    ]

    return WaterSummary(
        total_available_m3=round(avail, 2),
        expected_rainfall_m3=round(result.expected_rainfall_m3, 2),
        allocated_m3=round(allocated, 2),
        remaining_m3=round(alloc.remaining_m3, 2),
        allocation_pct=round(pct, 1),
        selected_crop_name=alloc.selected_crop_name or (result.top_recommendation.name if result.top_recommendation else None),
        net_demand_m3=round(alloc.net_demand_m3, 2),
        deficit_m3=round(alloc.deficit_m3, 2),
        surplus_m3=round(alloc.surplus_m3, 2),
        candidate_crops=candidates,
        irrigation_methods=methods,
    )


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


@router.post(
    "/plan/generate",
    response_model=PlanResponse,
    summary="Generate Budget-Aware Crop Plan",
    description=(
        "Accepts farm parameters and returns a categorized list of feasible crops "
        "(Category A), alternative crops with quantified adjustments (Category B), "
        "and unsuitable crops (Category C). Sized to realistic affordable parcels."
    ),
    tags=["Planning"],
)
def generate_crop_plan(farm_input: FarmInput) -> PlanResponse:
    """
    Run the agricultural planning pipeline for the given farm.

    Returns an HTTP 422 with a structured infeasibility message when no crop
    can satisfy constraints even on a partial parcel.
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
    alt_items = [_to_alternative_crop_item(a) for a in result.alternative_crops]
    unsuitable_items = [_to_unsuitable_crop_item(u) for u in result.rejected_crops]
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
        alternative_crops=alt_items,
        unsuitable_crops=unsuitable_items,
        budget_aware_notice=result.budget_aware_notice,
        planning_notes=result.planning_notes,
        data_source=result.data_source,
        disclaimer=result.disclaimer,
    )

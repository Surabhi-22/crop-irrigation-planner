"""End-to-end tests for the crop-planning optimization workflow."""

from optimizer.planning_service import create_crop_plan


def test_end_to_end_crop_plan_is_valid_and_within_water_budget():
    plots = [
        {"plot_id": "P1", "area_hectares": 1.0, "candidates": ["Rice", "Maize"]},
        {"plot_id": "P2", "area_hectares": 1.0, "candidates": ["Rice", "Maize"]},
    ]
    options = [
        {"plot_id": "P1", "crop": "Rice", "expected_profit_inr": 15000, "water_required_m3": 1800},
        {"plot_id": "P1", "crop": "Maize", "expected_profit_inr": 10000, "water_required_m3": 500},
        {"plot_id": "P2", "crop": "Rice", "expected_profit_inr": 14000, "water_required_m3": 1700},
        {"plot_id": "P2", "crop": "Maize", "expected_profit_inr": 9000, "water_required_m3": 400},
    ]

    result = create_crop_plan(
        plots=plots,
        options=options,
        available_water_m3=2200,
        allowed_crops=["Rice", "Maize"],
    )

    assert result["status"] == "success"
    assert result["input_validation"]["status"] == "valid"
    assert result["feasibility"]["status"] == "valid"

    plan = result["optimization"]
    assert len(plan["selected_crops"]) == len(plots)
    assert plan["total_water_required_m3"] <= 2200
    assert len({item["plot_id"] for item in plan["selected_crops"]}) == len(plots)

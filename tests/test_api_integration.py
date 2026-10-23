"""Integration tests for the shared Python prediction interface.

The project currently exposes Python functions, not HTTP routes.
These tests exercise the ML-to-planner interface directly.
"""

import json

from ml import predict_crop_plan
from optimizer.planning_service import create_predicted_crop_plan


def test_prediction_interface_returns_json_serializable_result():
    prediction = predict_crop_plan(
        crop="Maize",
        district="BELAGAVI",
        season="Kharif",
        area_hectares=1.0,
        year=2024,
        month=10,
    )

    # The shared prediction contract requires native JSON-compatible values.
    json.dumps(prediction)
    assert prediction["crop"] == "maize"
    assert prediction["district"] == "BELAGAVI"
    assert prediction["status"] in {
        "success", "partial_success", "unsupported_price_unit", "error"
    }


def test_ml_predictions_integrate_with_crop_planner():
    plots = [
        {"plot_id": "P1", "area_hectares": 1.0, "candidates": ["Maize"]}
    ]
    crop_inputs = {
        "Maize": {
            "cultivation_cost_inr_per_hectare": 8000,
            "irrigation_requirement_mm": 100,
        }
    }

    result = create_predicted_crop_plan(
        plots=plots,
        crop_inputs=crop_inputs,
        district="BELAGAVI",
        season="Kharif",
        available_water_m3=1200,
        allowed_crops=["Maize"],
        year=2024,
        month=10,
    )

    assert result["status"] == "success", result
    assert result["optimization"]["total_water_required_m3"] <= 1200
    assert result["feasibility"]["status"] == "valid"
    assert result["district"] == "BELAGAVI"
    assert result["prediction_year"] == 2024

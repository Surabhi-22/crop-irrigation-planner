"""
Tests for the crop planning endpoint: POST /api/v1/plan/generate.

Covers:
  - Successful plan generation with feasible inputs
  - Infeasibility due to insufficient budget (HTTP 422)
  - Infeasibility due to insufficient water (HTTP 422)
  - Handling of budget = 0 (unlimited budget)
  - Input validation rejection (negative values, missing fields)
  - Response contract validation (all expected schema fields)
  - Verification that existing endpoints remain unaffected
"""

import pytest


VALID_PLAN_PAYLOAD = {
    "area_acres": 5.0,
    "soil_type": "Loamy",
    "expected_rainfall_mm": 650.0,
    "available_water_m3": 5000.0,
    "location": "Bengaluru",
    "season": "Kharif",
    "budget_inr": 100000.0,
}


def test_generate_plan_success(client):
    """A feasible farm configuration returns 200 and a full plan."""
    response = client.post("/api/v1/plan/generate", json=VALID_PLAN_PAYLOAD)
    assert response.status_code == 200
    data = response.json()

    assert data["feasible"] is True
    assert data["farm_area_acres"] == 5.0
    assert data["season"] == "Kharif"
    assert data["location"] == "Bengaluru"
    assert data["soil_type"] == "Loamy"

    # Water summary
    water = data["water"]
    assert water["total_available_m3"] == 5000.0
    assert water["allocated_m3"] >= 0
    assert water["remaining_m3"] >= 0
    assert water["allocation_pct"] >= 0.0

    # Top recommendation
    top = data["top_recommendation"]
    assert top is not None
    assert "name" in top
    assert top["est_total_revenue_inr"] > 0
    assert top["est_total_profit_inr"] is not None

    # Feasible crops list
    feasible = data["all_feasible_crops"]
    assert isinstance(feasible, list)
    assert len(feasible) > 0

    # Metadata and disclaimers
    assert "ICAR" in data["data_source"]
    assert len(data["disclaimer"]) > 0
    assert isinstance(data["planning_notes"], list)


def test_generate_plan_null_budget_unconstrained(client):
    """budget_inr = None means unconstrained budget; planning succeeds for full farm capacity."""
    payload = {**VALID_PLAN_PAYLOAD, "budget_inr": None}
    response = client.post("/api/v1/plan/generate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["feasible"] is True
    assert any("unconstrained" in note.lower() for note in data["planning_notes"])


def test_generate_plan_zero_budget_indicates_zero_capital(client):
    """budget_inr = 0.0 indicates zero operational capital and returns 422 with actionable guidance."""
    payload = {**VALID_PLAN_PAYLOAD, "budget_inr": 0.0}
    response = client.post("/api/v1/plan/generate", json=payload)
    assert response.status_code == 422
    data = response.json()
    assert data["detail"]["error"] == "infeasible_plan"
    assert "zero" in data["detail"]["message"].lower() or "budget" in data["detail"]["message"].lower()
    assert len(data["detail"]["suggestions"]) > 0


def test_generate_plan_infeasible_low_budget(client):
    """An unrealistically tiny budget for 5 acres should return HTTP 422 with suggestions."""
    payload = {**VALID_PLAN_PAYLOAD, "budget_inr": 100.0}
    response = client.post("/api/v1/plan/generate", json=payload)
    assert response.status_code == 422
    data = response.json()

    assert "detail" in data
    detail = data["detail"]
    assert detail["error"] == "infeasible_plan"
    assert "budget" in detail["message"].lower() or len(detail["suggestions"]) > 0
    assert isinstance(detail["suggestions"], list)


def test_generate_plan_infeasible_zero_water_and_rainfall(client):
    """Zero rainfall and zero irrigation water makes crop growth infeasible."""
    payload = {
        **VALID_PLAN_PAYLOAD,
        "available_water_m3": 0.0,
        "expected_rainfall_mm": 0.0,
    }
    response = client.post("/api/v1/plan/generate", json=payload)
    assert response.status_code == 422
    data = response.json()
    assert data["detail"]["error"] == "infeasible_plan"
    assert "water" in data["detail"]["message"].lower() or len(data["detail"]["suggestions"]) > 0


def test_generate_plan_rejects_negative_area(client):
    """Pydantic validation rejects negative area with 422."""
    payload = {**VALID_PLAN_PAYLOAD, "area_acres": -5.0}
    response = client.post("/api/v1/plan/generate", json=payload)
    assert response.status_code == 422


def test_generate_plan_rejects_missing_field(client):
    """Pydantic validation rejects missing required fields with 422."""
    payload = {k: v for k, v in VALID_PLAN_PAYLOAD.items() if k != "season"}
    response = client.post("/api/v1/plan/generate", json=payload)
    assert response.status_code == 422


def test_plan_response_contract_fields(client):
    """Ensure response has all contractually guaranteed keys."""
    response = client.post("/api/v1/plan/generate", json=VALID_PLAN_PAYLOAD)
    assert response.status_code == 200
    data = response.json()

    expected_top_keys = {
        "feasible",
        "infeasibility_reason",
        "infeasibility_suggestions",
        "farm_area_acres",
        "season",
        "location",
        "soil_type",
        "water",
        "top_recommendation",
        "all_feasible_crops",
        "planning_notes",
        "data_source",
        "disclaimer",
    }
    assert expected_top_keys.issubset(data.keys())

    expected_item_keys = {
        "name",
        "season",
        "duration_days",
        "notes",
        "water_req_mm",
        "irrigation_req_m3",
        "yield_t_per_acre",
        "price_inr_per_tonne",
        "cost_inr_per_acre",
        "est_total_yield_tonnes",
        "est_total_revenue_inr",
        "est_total_cost_inr",
        "est_total_profit_inr",
    }
    assert expected_item_keys.issubset(data["top_recommendation"].keys())


def test_existing_endpoints_unaffected(client):
    """Ensure /farm/validate and /health continue working without regression."""
    val_resp = client.post(
        "/api/v1/farm/validate",
        json={
            "area_acres": 5.0,
            "soil_type": "Loamy",
            "expected_rainfall_mm": 650.0,
            "available_water_m3": 3000.0,
            "location": "Bengaluru",
            "season": "Kharif",
            "budget_inr": 8500.0,
        },
    )
    assert val_resp.status_code == 200
    assert val_resp.json()["valid"] is True

    health_resp = client.get("/api/v1/health")
    assert health_resp.status_code == 200
    assert health_resp.json()["status"] == "healthy"


def test_generate_plan_with_default_farm_form_payload(client):
    """
    Ensure plan generation succeeds with the default CropWise baseline form payload
    (5 acres, Loamy soil, 3000 m³ water reserve, 650 mm rainfall, 100,000 INR budget).
    """
    payload = {
        "area_acres": 5.0,
        "soil_type": "Loamy",
        "expected_rainfall_mm": 650.0,
        "available_water_m3": 3000.0,
        "location": "Bengaluru",
        "season": "Kharif",
        "budget_inr": 100000.0,
    }
    response = client.post("/api/v1/plan/generate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["feasible"] is True
    assert data["top_recommendation"] is not None
    assert len(data["all_feasible_crops"]) >= 1


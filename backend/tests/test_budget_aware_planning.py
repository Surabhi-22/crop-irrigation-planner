"""
Tests for Budget-Aware Cultivation and Three-Tier Recommendation Engine.

Requirements tested:
  1. 8-acre farm with insufficient total budget generates viable recommendations.
  2. Sized smaller cultivated area strictly within available budget.
  3. Adequate budget allows full-farm (100%) cultivation.
  4. Insufficient irrigation water restricts area or marks crop as water-constrained.
  5. Incompatible soil is categorized as Alternative (soil) or Unsuitable.
  6. Incompatible season is categorized as Alternative (season) or Unsuitable.
  7. Budget = 0 handles unconstrained budget; negative budget rejected by Pydantic.
  8. Multiple feasible crop recommendations are ranked by net profit and ROI.
  9. Extremely low budget (< 0.1-acre viable cost) returns 422 with actionable suggestions.
  10. Accurate yield, cost, revenue, profit, and remaining budget calculations.
"""

import pytest
from app.services.crop_data import CROP_DB, MM_PER_ACRE_TO_M3
from app.services.crop_selector import select_feasible_crops


# ── Test 1: 8-acre farm with ₹8,555 budget (the problem statement case) ─────


def test_eight_acre_farm_budget_aware_recommendations(client):
    """
    Inputs: 8 acres, Rabi season, Sandy soil, 650 mm rainfall, 3000 m³ water, ₹8,555 budget.
    Previously failed with 'No feasible crops found'.
    Now successfully returns 5 feasible crops sized to affordable parcels.
    """
    payload = {
        "area_acres": 8.0,
        "soil_type": "Sandy",
        "expected_rainfall_mm": 650.0,
        "available_water_m3": 3000.0,
        "location": "Bangalore Rural",
        "season": "Rabi",
        "budget_inr": 8555.0,
    }
    response = client.post("/api/v1/plan/generate", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["feasible"] is True
    assert data["farm_area_acres"] == 8.0
    assert data["budget_aware_notice"] is not None
    assert "budget" in data["budget_aware_notice"].lower()

    # Category A: Recommended crops
    recommended = data["all_feasible_crops"]
    assert len(recommended) == 5
    crop_names = [c["name"] for c in recommended]
    assert "Chickpea (Chana)" in crop_names
    assert "Sorghum (Jowar)" in crop_names
    assert "Mustard (Rapeseed)" in crop_names
    assert "Maize (Corn)" in crop_names
    assert "Groundnut (Peanut)" in crop_names

    # Check top recommendation
    top = data["top_recommendation"]
    assert top["name"] == "Chickpea (Chana)"
    assert top["recommended_area_acres"] == 0.95
    assert top["remaining_area_acres"] == 7.05
    assert top["is_partial_area"] is True
    assert top["limiting_factor"] == "Budget"
    assert top["est_total_cost_inr"] <= 8555.0
    assert top["est_total_profit_inr"] > 0

    # Category B: Alternatives
    alternatives = data["alternative_crops"]
    assert len(alternatives) >= 3
    alt_names = [a["name"] for a in alternatives]
    assert "Pearl Millet (Bajra)" in alt_names  # Season alternative
    assert "Wheat" in alt_names                 # Soil alternative

    # Category C: Unsuitable
    unsuitable = data["unsuitable_crops"]
    assert len(unsuitable) >= 2
    uns_names = [u["name"] for u in unsuitable]
    assert "Rice (Paddy)" in uns_names
    assert "Cotton" in uns_names


# ── Test 2: Smaller cultivated area strictly respects budget ceiling ────────


def test_partial_parcel_never_exceeds_budget():
    """Verify mathematically that cultivated_area * cost_per_acre <= budget_inr."""
    budget = 8555.0
    feasible, _, _ = select_feasible_crops(
        season="Rabi",
        soil_type="Sandy",
        area_acres=8.0,
        expected_rainfall_mm=650.0,
        available_water_m3=3000.0,
        budget_inr=budget,
    )
    assert len(feasible) > 0
    for crop in feasible:
        assert crop.total_cost_inr <= budget, f"{crop.name} exceeded budget"
        assert crop.cultivated_area_acres <= 8.0
        assert crop.remaining_budget_inr >= 0.0
        assert round(crop.cultivated_area_acres + crop.remaining_area_acres, 2) == 8.0


# ── Test 3: Adequate budget cultivates entire farm area (100%) ───────────────


def test_adequate_budget_full_farm_cultivation(client):
    """When budget is abundant, entire farm area (100%) is recommended."""
    payload = {
        "area_acres": 8.0,
        "soil_type": "Sandy",
        "expected_rainfall_mm": 650.0,
        "available_water_m3": 3000.0,
        "location": "Bangalore Rural",
        "season": "Rabi",
        "budget_inr": 200000.0,  # Plenty of budget
    }
    response = client.post("/api/v1/plan/generate", json=payload)
    assert response.status_code == 200
    data = response.json()

    top = data["top_recommendation"]
    assert top["recommended_area_acres"] == 8.0
    assert top["remaining_area_acres"] == 0.0
    assert top["is_partial_area"] is False
    assert top["limiting_factor"] == "None"
    assert top["budget_gap_for_full_area_inr"] == 0.0


# ── Test 4: Water limitation constrains cultivated area ──────────────────────


def test_water_limitation_restricts_area():
    """
    When rainfall is low and water reserve is scarce, water becomes the
    limiting constraint instead of budget.
    """
    # Rice needs 1150 mm; rainfall=150 mm -> eff=1000 mm -> 4,046.86 m³/ac
    # With 10,000 m³ water and unlimited budget on 10 acres:
    # Max water area = 10,000 / 4046.86 = 2.47 acres
    feasible, _, _ = select_feasible_crops(
        season="Kharif",
        soil_type="Clay",
        area_acres=10.0,
        expected_rainfall_mm=150.0,
        available_water_m3=10000.0,
        budget_inr=500000.0,
    )
    rice = next(c for c in feasible if "Rice" in c.name)
    assert rice.is_partial_area is True
    assert rice.limiting_factor == "Water"
    assert rice.cultivated_area_acres <= 2.50
    assert rice.remaining_area_acres >= 7.50


# ── Test 5: Incompatible soil categorized as Alternative ───────────────────


def test_incompatible_soil_categorized_as_alternative():
    """Wheat in Rabi season requires Loamy/Clay/Silty soil. On Sandy soil it is an Alternative."""
    _, alternatives, _ = select_feasible_crops(
        season="Rabi",
        soil_type="Sandy",
        area_acres=5.0,
        expected_rainfall_mm=650.0,
        available_water_m3=3000.0,
        budget_inr=100000.0,
    )
    wheat_alt = next((a for a in alternatives if a.name == "Wheat"), None)
    assert wheat_alt is not None
    assert wheat_alt.adjustment_type == "soil"
    assert "loamy" in wheat_alt.required_adjustment.lower()


# ── Test 6: Incompatible season categorized as Alternative ──────────────────


def test_incompatible_season_categorized_as_alternative():
    """Pearl Millet grows in Kharif/Summer on Sandy soil. In Rabi season it is an Alternative."""
    _, alternatives, _ = select_feasible_crops(
        season="Rabi",
        soil_type="Sandy",
        area_acres=5.0,
        expected_rainfall_mm=650.0,
        available_water_m3=3000.0,
        budget_inr=100000.0,
    )
    millet_alt = next((a for a in alternatives if "Pearl Millet" in a.name), None)
    assert millet_alt is not None
    assert millet_alt.adjustment_type == "season"
    assert "kharif" in millet_alt.required_adjustment.lower()


# ── Test 7: Null budget (unconstrained), Zero budget, and negative budget ──


def test_null_budget_unconstrained_zero_and_negative_rejected(client):
    """budget=None is unconstrained; budget=0 indicates zero capital; negative is rejected."""
    # Budget = None (unconstrained)
    resp_null = client.post(
        "/api/v1/plan/generate",
        json={
            "area_acres": 5.0,
            "soil_type": "Loamy",
            "expected_rainfall_mm": 650.0,
            "available_water_m3": 3000.0,
            "location": "Bengaluru",
            "season": "Kharif",
            "budget_inr": None,
        },
    )
    assert resp_null.status_code == 200
    assert resp_null.json()["feasible"] is True

    # Budget = 0.0 (zero operational capital)
    resp_zero = client.post(
        "/api/v1/plan/generate",
        json={
            "area_acres": 5.0,
            "soil_type": "Loamy",
            "expected_rainfall_mm": 650.0,
            "available_water_m3": 3000.0,
            "location": "Bengaluru",
            "season": "Kharif",
            "budget_inr": 0.0,
        },
    )
    assert resp_zero.status_code == 422
    assert "zero" in resp_zero.json()["detail"]["message"].lower() or "budget" in resp_zero.json()["detail"]["message"].lower()

    # Negative budget
    resp_neg = client.post(
        "/api/v1/plan/generate",
        json={
            "area_acres": 5.0,
            "soil_type": "Loamy",
            "expected_rainfall_mm": 650.0,
            "available_water_m3": 3000.0,
            "location": "Bengaluru",
            "season": "Kharif",
            "budget_inr": -500.0,
        },
    )
    assert resp_neg.status_code == 422


# ── Test 8: Multiple feasible crop ranking by net profit and ROI ────────────


def test_ranking_by_net_profit_and_roi():
    """Feasible crops are ranked by estimated net profit descending."""
    feasible, _, _ = select_feasible_crops(
        season="Rabi",
        soil_type="Sandy",
        area_acres=8.0,
        expected_rainfall_mm=650.0,
        available_water_m3=3000.0,
        budget_inr=8555.0,
    )
    assert len(feasible) >= 2
    for i in range(len(feasible) - 1):
        assert feasible[i].total_profit_inr >= feasible[i + 1].total_profit_inr


# ── Test 9: No feasible crops when budget cannot fund minimum 0.1-acre plot ──


def test_infeasible_when_budget_below_minimum_parcel(client):
    """
    A budget of ₹50 cannot fund even 0.1 acre of any crop (cheapest is Sorghum at ₹7,000/ac -> ₹700).
    Returns HTTP 422 with actionable suggestions.
    """
    payload = {
        "area_acres": 8.0,
        "soil_type": "Sandy",
        "expected_rainfall_mm": 650.0,
        "available_water_m3": 3000.0,
        "location": "Bangalore Rural",
        "season": "Rabi",
        "budget_inr": 50.0,  # Below ₹700 minimum parcel cost
    }
    response = client.post("/api/v1/plan/generate", json=payload)
    assert response.status_code == 422
    data = response.json()
    assert data["detail"]["error"] == "infeasible_plan"
    assert len(data["detail"]["suggestions"]) > 0


# ── Test 10: Mathematical and physical units verification ────────────────────


def test_exact_financial_and_yield_calculations():
    """
    Verify yield, revenue, cost, profit, and water calculations against ICAR dataset benchmarks.
    For Chickpea on Sandy soil, 8 acres, ₹8,555 budget:
      ICAR Benchmark: cost = ₹9,000/ac, yield = 0.6 t/ac, price = ₹55,000/t, water = 300 mm.
      Available budget: ₹8,555 -> 8555 / 9000 = 0.95055... -> 0.95 acres.
      Total cost = 0.95 * 9000 = ₹8,550.0
      Total yield = 0.95 * 0.6 = 0.57 tonnes
      Total revenue = 0.57 * 55,000 = ₹31,350.0
      Total profit = 31,350 - 8,550 = ₹22,800.0
      ROI = (22,800 / 8,550) * 100 = 266.7%
      Remaining budget = 8,555 - 8,550 = ₹5.0
    """
    feasible, _, _ = select_feasible_crops(
        season="Rabi",
        soil_type="Sandy",
        area_acres=8.0,
        expected_rainfall_mm=650.0,
        available_water_m3=3000.0,
        budget_inr=8555.0,
    )
    chickpea = next(c for c in feasible if "Chickpea" in c.name)

    assert chickpea.cultivated_area_acres == 0.95
    assert chickpea.total_cost_inr == 8550.0
    assert chickpea.total_yield_tonnes == 0.57
    assert chickpea.total_revenue_inr == 31350.0
    assert chickpea.total_profit_inr == 22800.0
    assert chickpea.roi_pct == 266.7
    assert chickpea.remaining_budget_inr == 5.0
    assert chickpea.remaining_area_acres == 7.05
    assert chickpea.full_area_cost_inr == 72000.0
    assert chickpea.budget_gap_for_full_area_inr == 63445.0


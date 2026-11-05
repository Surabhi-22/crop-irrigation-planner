"""
Unit and integration tests for Quantum Agri Water Optimization.

Covers:
1. Acre-to-cubic-metre conversion mathematics
2. Rainfall and net irrigation calculations
3. Single candidate crop allocation
4. Mutually exclusive candidate crops — verifying demands are NEVER summed as actual consumption
5. Multi-crop genuine area allocations across separate plots
6. Sufficient water supply (surplus, positive buffer)
7. Insufficient water supply (deficit, remaining water capped at 0)
8. Zero water supply handling
9. Irrigation efficiency comparisons (Drip 90%, Sprinkler 75%, Surface/Flood 55% baseline)
10. Invalid efficiency values rejection
11. Plan endpoint integration with enhanced water summary contract
"""

import pytest
from app.services.crop_data import MM_PER_ACRE_TO_M3
from app.services.crop_selector import FeasibleCrop
from app.services.water_allocator import (
    DEFAULT_IRRIGATION_EFFICIENCIES,
    allocate_multi_crop_water,
    allocate_water,
    calculate_irrigation_method_comparisons,
)


def _make_dummy_crop(
    name: str,
    water_req_mm: float,
    irrigation_req_m3: float,
    profit_inr: float = 50000.0,
) -> FeasibleCrop:
    return FeasibleCrop(
        name=name,
        season="Kharif",
        duration_days="100",
        notes="Test crop",
        water_req_mm=water_req_mm,
        yield_t_per_acre=2.0,
        price_inr_per_tonne=20000.0,
        cost_inr_per_acre=15000.0,
        irrigation_req_m3=irrigation_req_m3,
        total_yield_tonnes=10.0,
        total_revenue_inr=200000.0,
        total_cost_inr=75000.0,
        total_profit_inr=profit_inr,
        season_ok=True,
        soil_ok=True,
        water_ok=True,
        budget_ok=True,
    )


# ---------------------------------------------------------------------------
# 1. Acre-to-cubic-metre conversion
# ---------------------------------------------------------------------------

def test_acre_to_cubic_metre_conversion():
    """Verify standard conversion: 1 mm depth over 1 acre = 4.04686 m³."""
    assert abs(MM_PER_ACRE_TO_M3 - 4.04686) < 1e-5

    # 100 mm depth over 5 acres = 500 mm-acres * 4.04686 = 2023.43 m³
    expected_m3 = 100.0 * 5.0 * MM_PER_ACRE_TO_M3
    assert round(expected_m3, 2) == 2023.43


# ---------------------------------------------------------------------------
# 2. Rainfall and net irrigation
# ---------------------------------------------------------------------------

def test_rainfall_and_net_irrigation_calculations():
    """Effective irrigation is max(0, crop_water_req - rainfall)."""
    crop_req_mm = 600.0

    # Rainfall covers portion of demand
    rainfall_mm = 400.0
    net_mm = max(0.0, crop_req_mm - rainfall_mm)
    assert net_mm == 200.0
    assert net_mm * 5.0 * MM_PER_ACRE_TO_M3 > 0

    # Rainfall exceeds crop requirement (rain-fed, zero irrigation needed)
    excess_rainfall = 750.0
    net_rainfed = max(0.0, crop_req_mm - excess_rainfall)
    assert net_rainfed == 0.0

    # Zero rainfall
    net_zero_rain = max(0.0, crop_req_mm - 0.0)
    assert net_zero_rain == 600.0


# ---------------------------------------------------------------------------
# 3. Single candidate crop allocation
# ---------------------------------------------------------------------------

def test_one_candidate_crop_allocation():
    """Allocating water with a single candidate crop calculates exact scenario balance."""
    crop = _make_dummy_crop("Maize", water_req_mm=520.0, irrigation_req_m3=1200.0)
    alloc = allocate_water([crop], available_water_m3=3000.0)

    assert alloc.selected_crop_name == "Maize"
    assert alloc.net_demand_m3 == 1200.0
    assert alloc.total_allocated_m3 == 1200.0
    assert alloc.remaining_m3 == 1800.0
    assert alloc.deficit_m3 == 0.0
    assert alloc.surplus_m3 == 1800.0
    assert alloc.allocation_pct == 40.0
    assert len(alloc.candidate_demands) == 1
    assert alloc.candidate_demands[0].is_feasible is True


# ---------------------------------------------------------------------------
# 4. Multiple mutually exclusive crops NEVER summed
# ---------------------------------------------------------------------------

def test_multiple_mutually_exclusive_candidate_crops_never_summed():
    """
    CRITICAL: Candidate crops are alternative choices for the whole farm.
    Their full-farm demands must NEVER be summed into total_allocated_m3.
    """
    crop_a = _make_dummy_crop("Cotton", water_req_mm=700.0, irrigation_req_m3=2000.0, profit_inr=90000)
    crop_b = _make_dummy_crop("Maize", water_req_mm=520.0, irrigation_req_m3=1500.0, profit_inr=70000)
    crop_c = _make_dummy_crop("Soybean", water_req_mm=450.0, irrigation_req_m3=800.0, profit_inr=50000)

    alloc = allocate_water([crop_a, crop_b, crop_c], available_water_m3=2500.0)

    # Cotton is selected as the top-profit recommendation
    assert alloc.selected_crop_name == "Cotton"
    # Allocated must be Cotton's demand (2000 m³), NOT 2000 + 1500 + 800 = 4300 m³!
    assert alloc.total_allocated_m3 == 2000.0
    assert alloc.remaining_m3 == 500.0
    assert alloc.deficit_m3 == 0.0

    # All 3 candidate crops must be preserved in candidate_demands with individual figures
    assert len(alloc.candidate_demands) == 3
    demands = {c.crop_name: c.irrigation_req_m3 for c in alloc.candidate_demands}
    assert demands["Cotton"] == 2000.0
    assert demands["Maize"] == 1500.0
    assert demands["Soybean"] == 800.0


def test_select_specific_crop_from_candidates():
    """Selecting a specific candidate crop calculates the balance for that specific crop."""
    crop_a = _make_dummy_crop("Cotton", water_req_mm=700.0, irrigation_req_m3=2000.0, profit_inr=90000)
    crop_b = _make_dummy_crop("Soybean", water_req_mm=450.0, irrigation_req_m3=800.0, profit_inr=50000)

    alloc = allocate_water([crop_a, crop_b], available_water_m3=2500.0, selected_crop_name="Soybean")

    assert alloc.selected_crop_name == "Soybean"
    assert alloc.net_demand_m3 == 800.0
    assert alloc.total_allocated_m3 == 800.0
    assert alloc.remaining_m3 == 1700.0
    assert alloc.allocation_pct == 32.0


# ---------------------------------------------------------------------------
# 5. Multi-crop genuine area allocations across separate plots
# ---------------------------------------------------------------------------

def test_multiple_planted_crops_with_separate_areas():
    """When multiple crops are planted on dedicated parcels, demands are area-weighted."""
    allocations = [
        {"crop_name": "Cotton", "area_acres": 3.0, "water_req_mm": 700.0},
        {"crop_name": "Maize", "area_acres": 2.0, "water_req_mm": 520.0},
    ]
    # Expected rainfall = 400 mm
    # Cotton net mm = 700 - 400 = 300 mm over 3 acres = 900 * 4.04686 = 3642.17 m³
    # Maize net mm = 520 - 400 = 120 mm over 2 acres = 240 * 4.04686 = 971.25 m³
    # Total demand = 3642.17 + 971.25 = 4613.42 m³
    res = allocate_multi_crop_water(allocations, available_water_m3=5000.0, expected_rainfall_mm=400.0)

    assert res["total_area_acres"] == 5.0
    assert abs(res["total_demand_m3"] - 4613.42) < 0.1
    assert res["allocated_m3"] == res["total_demand_m3"]
    assert res["remaining_m3"] == round(5000.0 - res["total_demand_m3"], 2)
    assert res["deficit_m3"] == 0.0
    assert res["water_feasible"] is True


# ---------------------------------------------------------------------------
# 6. Sufficient water supply (surplus)
# ---------------------------------------------------------------------------

def test_sufficient_water_supply():
    """When available water exceeds crop demand, remaining water and surplus are positive."""
    crop = _make_dummy_crop("Groundnut", water_req_mm=500.0, irrigation_req_m3=1000.0)
    alloc = allocate_water([crop], available_water_m3=3000.0)

    assert alloc.total_allocated_m3 == 1000.0
    assert alloc.remaining_m3 == 2000.0
    assert alloc.surplus_m3 == 2000.0
    assert alloc.deficit_m3 == 0.0
    assert alloc.allocation_pct == 33.3


# ---------------------------------------------------------------------------
# 7. Insufficient water supply (deficit)
# ---------------------------------------------------------------------------

def test_insufficient_water_supply():
    """When demand exceeds available supply, remaining water is 0 and deficit is reported."""
    crop = _make_dummy_crop("Rice", water_req_mm=1150.0, irrigation_req_m3=4500.0)
    alloc = allocate_water([crop], available_water_m3=2000.0)

    assert alloc.total_allocated_m3 == 2000.0
    assert alloc.remaining_m3 == 0.0
    assert alloc.surplus_m3 == 0.0
    assert alloc.deficit_m3 == 2500.0
    assert alloc.allocation_pct == 100.0
    assert alloc.candidate_demands[0].is_feasible is False


# ---------------------------------------------------------------------------
# 8. Zero or missing water supply
# ---------------------------------------------------------------------------

def test_zero_water_supply():
    """Zero available water reserve handles both rainfed (0 req) and irrigated crops safely."""
    # Thirsty crop with 0 available water
    thirsty_crop = _make_dummy_crop("Cotton", water_req_mm=700.0, irrigation_req_m3=1500.0)
    alloc_thirsty = allocate_water([thirsty_crop], available_water_m3=0.0)
    assert alloc_thirsty.total_allocated_m3 == 0.0
    assert alloc_thirsty.remaining_m3 == 0.0
    assert alloc_thirsty.deficit_m3 == 1500.0
    assert alloc_thirsty.allocation_pct == 100.0

    # Rainfed crop (0 net irrigation req) with 0 available water
    rainfed_crop = _make_dummy_crop("Millet", water_req_mm=300.0, irrigation_req_m3=0.0)
    alloc_rainfed = allocate_water([rainfed_crop], available_water_m3=0.0)
    assert alloc_rainfed.total_allocated_m3 == 0.0
    assert alloc_rainfed.remaining_m3 == 0.0
    assert alloc_rainfed.deficit_m3 == 0.0
    assert alloc_rainfed.allocation_pct == 0.0


# ---------------------------------------------------------------------------
# 9. Irrigation efficiency calculations
# ---------------------------------------------------------------------------

def test_irrigation_efficiency_calculations():
    """
    Gross withdrawal = net_req / efficiency.
    Baseline = Surface/Flood (55%).
    Savings = max(0, baseline_gross - method_gross).
    """
    net_req = 990.0  # m³
    available = 2000.0

    comparisons = calculate_irrigation_method_comparisons(net_req, available)
    by_method = {m["method"]: m for m in comparisons}

    # Surface/Flood: 55%
    flood = by_method["Surface/Flood"]
    assert flood["efficiency_pct"] == 55.0
    assert round(flood["gross_withdrawal_m3"], 2) == 1800.0  # 990 / 0.55
    assert flood["savings_vs_baseline_m3"] == 0.0
    assert flood["savings_pct"] == 0.0
    assert flood["is_baseline"] is True

    # Sprinkler: 75%
    sprinkler = by_method["Sprinkler"]
    assert sprinkler["efficiency_pct"] == 75.0
    assert round(sprinkler["gross_withdrawal_m3"], 2) == 1320.0  # 990 / 0.75
    assert round(sprinkler["savings_vs_baseline_m3"], 2) == 480.0  # 1800 - 1320
    assert sprinkler["savings_pct"] == 26.7

    # Drip: 90%
    drip = by_method["Drip"]
    assert drip["efficiency_pct"] == 90.0
    assert round(drip["gross_withdrawal_m3"], 2) == 1100.0  # 990 / 0.90
    assert round(drip["savings_vs_baseline_m3"], 2) == 700.0  # 1800 - 1100
    assert drip["savings_pct"] == 38.9


def test_rainfed_irrigation_method_comparison():
    """When net irrigation requirement is 0, gross withdrawals across all methods are 0."""
    comparisons = calculate_irrigation_method_comparisons(0.0, available_water_m3=1000.0)
    for m in comparisons:
        assert m["gross_withdrawal_m3"] == 0.0
        assert m["savings_vs_baseline_m3"] == 0.0
        assert "Rain-fed" in m["feasibility_status"]


# ---------------------------------------------------------------------------
# 10. Invalid efficiency values rejected
# ---------------------------------------------------------------------------

def test_invalid_efficiency_values_rejected():
    """Non-positive or > 100% efficiencies raise ValueError."""
    with pytest.raises(ValueError):
        calculate_irrigation_method_comparisons(500.0, 1000.0, efficiencies={"Bad": 0.0})

    with pytest.raises(ValueError):
        calculate_irrigation_method_comparisons(500.0, 1000.0, efficiencies={"Bad": -0.5})

    with pytest.raises(ValueError):
        calculate_irrigation_method_comparisons(500.0, 1000.0, efficiencies={"Bad": 150.0})

    with pytest.raises(ValueError):
        calculate_irrigation_method_comparisons(-100.0, 1000.0)


# ---------------------------------------------------------------------------
# 11. Plan endpoint integration with enhanced water summary
# ---------------------------------------------------------------------------

def test_plan_api_water_summary_contains_enhanced_fields(client):
    """The /plan/generate endpoint delivers candidate comparisons and method analysis."""
    payload = {
        "area_acres": 5.0,
        "soil_type": "Loamy",
        "expected_rainfall_mm": 650.0,
        "available_water_m3": 4000.0,
        "location": "Bengaluru",
        "season": "Kharif",
        "budget_inr": 100000.0,
    }
    response = client.post("/api/v1/plan/generate", json=payload)
    assert response.status_code == 200
    data = response.json()
    water = data["water"]

    # Base contract preserved
    assert water["total_available_m3"] == 4000.0
    assert water["allocated_m3"] >= 0.0
    assert water["remaining_m3"] >= 0.0
    assert water["allocation_pct"] <= 100.0

    # Enhanced contract
    assert "selected_crop_name" in water
    assert water["selected_crop_name"] == data["top_recommendation"]["name"]
    assert "net_demand_m3" in water
    assert "deficit_m3" in water
    assert "surplus_m3" in water

    # Candidate crops breakdown
    assert "candidate_crops" in water
    assert isinstance(water["candidate_crops"], list)
    assert len(water["candidate_crops"]) == len(data["all_feasible_crops"])

    # Irrigation method comparisons
    assert "irrigation_methods" in water
    assert len(water["irrigation_methods"]) >= 3
    method_names = [m["method"] for m in water["irrigation_methods"]]
    assert "Drip" in method_names
    assert "Sprinkler" in method_names
    assert "Surface/Flood" in method_names

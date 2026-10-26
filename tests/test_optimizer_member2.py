import pytest

from optimizer.objective import calculate_crop_economics
from optimizer.water_allocation import calculate_plot_water, summarize_water_allocation
from optimizer.constraints import validate_planning_inputs
from optimizer.crop_optimizer import optimize_crop_plan
from optimizer.feasibility_checker import validate_crop_plan
from optimizer.simulated_annealing import optimize_crop_plan_sa
from optimizer.qaoa_optimizer import optimize_crop_plan_qaoa


def sample_plots():
    return [
        {"plot_id": "P1", "area_hectares": 1.0, "candidates": ["Rice", "Maize"]},
        {"plot_id": "P2", "area_hectares": 1.0, "candidates": ["Rice", "Maize"]},
    ]


def sample_options():
    return [
        {"plot_id": "P1", "crop": "Rice", "expected_profit_inr": 15000, "water_required_m3": 1800},
        {"plot_id": "P1", "crop": "Maize", "expected_profit_inr": 10000, "water_required_m3": 500},
        {"plot_id": "P2", "crop": "Rice", "expected_profit_inr": 14000, "water_required_m3": 1700},
        {"plot_id": "P2", "crop": "Maize", "expected_profit_inr": 9000, "water_required_m3": 400},
    ]


def test_crop_economics_calculates_profit():
    result = calculate_crop_economics(
        crop="Maize",
        area_hectares=2,
        predicted_yield_tonnes_per_hectare=3,
        predicted_price_per_tonne=20000,
        cultivation_cost_inr_per_hectare=8000,
    )
    assert result["status"] == "success"
    assert result["expected_profit_inr"] == 104000


def test_water_calculation():
    result = calculate_plot_water("P1", "Maize", 2, 100)
    assert result["water_required_m3"] == 2000


def test_water_budget_summary():
    result = summarize_water_allocation(
        [{"water_required_m3": 2000}], available_water_m3=2500
    )
    assert result["water_feasible"] is True
    assert result["remaining_water_m3"] == 500


def test_planning_input_validation():
    result = validate_planning_inputs(
        sample_plots(), 2200, ["Rice", "Maize"]
    )
    assert result["status"] == "valid"


def test_scipy_optimizer_respects_water_budget():
    result = optimize_crop_plan(sample_plots(), sample_options(), 2200)
    assert result["status"] == "success"
    assert result["total_water_required_m3"] <= 2200


def test_feasibility_checker_accepts_valid_plan():
    selected = [
        {"plot_id": "P1", "crop": "Rice", "expected_profit_inr": 15000, "water_required_m3": 1800},
        {"plot_id": "P2", "crop": "Maize", "expected_profit_inr": 9000, "water_required_m3": 400},
    ]
    result = validate_crop_plan(sample_plots(), selected, 2200)
    assert result["status"] == "valid"


def test_simulated_annealing_returns_feasible_plan():
    result = optimize_crop_plan_sa(
        sample_plots(), sample_options(), 2200, random_seed=42
    )
    assert result["status"] == "success"
    assert result["total_water_required_m3"] <= 2200
    assert len(result["selected_crops"]) == 2


def test_simulated_annealing_reports_infeasible_budget():
    plots = [{"plot_id": "P1", "area_hectares": 1, "candidates": ["Rice"]}]
    options = [
        {"plot_id": "P1", "crop": "Rice", "expected_profit_inr": 100, "water_required_m3": 1000}
    ]
    result = optimize_crop_plan_sa(plots, options, 500)
    assert result["status"] == "infeasible"


def test_qaoa_returns_a_recognized_result_status():
    result = optimize_crop_plan_qaoa(
        sample_plots(), sample_options(), 2200,
        reps=1, seed=42, max_iterations=5,
    )
    assert result["status"] in {
        "success",
        "infeasible",
        "invalid_input",
        "dependency_unavailable",
        "no_solution",
        "no_feasible_solution",
        "optimization_error",
    }

    if result["status"] == "success":
        assert len(result["selected_crops"]) == len(sample_plots())
        assert result["total_water_required_m3"] <= 2200

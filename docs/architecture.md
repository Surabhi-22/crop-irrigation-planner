# System Architecture

## Overview

The Crop & Irrigation Planner combines historical-data ML predictions with
constrained crop selection. Its current implementation exposes Python modules;
this document does not describe an HTTP server or deployed web API.

## Main components

1. **ML prediction (`ml/`)**
   - `yield_prediction.py`: crop-yield inference.
   - `price_prediction.py`: wholesale benchmark price inference.
   - `prediction_service.py`: unified prediction interface.
   - Pre-trained artifacts are stored under `models/`.

2. **Prediction adapter (`optimizer/prediction_adapter.py`)**
   - Converts prediction results, cultivation costs, and irrigation inputs
     into crop options suitable for optimization.

3. **Planning service (`optimizer/planning_service.py`)**
   - `create_predicted_crop_plan()` prepares options from ML predictions.
   - `create_crop_plan()` validates inputs, optimizes the plan, and
     independently checks feasibility.

4. **Optimization (`optimizer/`)**
   - `objective.py`: production, revenue, cost, and expected profit.
   - `water_allocation.py`: irrigation-volume calculations.
   - `constraints.py`: planning-input validation.
   - `crop_optimizer.py`: SciPy mixed-integer optimization.
   - `feasibility_checker.py`: independent plan validation.
   - `simulated_annealing.py`: heuristic alternative.
   - `qaoa_optimizer.py`: experimental QAOA alternative.

## Data flow

```text
Historical datasets and trained model artifacts
                    |
                    v
           ML prediction service
                    |
                    v
            Prediction adapter
                    |
                    v
         Crop options (profit/water)
                    |
                    v
       Input validation and optimizer
                    |
                    v
       Independent feasibility checker
                    |
                    v
             Crop-plan result
```

## Constraints and assumptions

- Every plot must receive exactly one eligible crop.
- Total irrigation water must not exceed the available budget for the
  same planning period.
- Irrigation volume uses `area_hectares * irrigation_requirement_mm * 10`.
- Cultivation costs and irrigation requirements must be supplied with
  consistent units and assumptions.
- Expected profit is an estimate, not guaranteed farm income.
- QAOA currently omits the water inequality from its quantum model and
  checks water feasibility after solving. It may fail to find a feasible
  assignment even when one exists. Use the SciPy optimizer as the primary
  constrained optimizer.

## Verification

Run `python -m pytest -q` from the project root with the project environment
activated.

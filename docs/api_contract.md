# Shared Python API Contract

## Scope

The project currently provides Python function interfaces. No HTTP routes
were found in the current project scan. This document specifies the existing
prediction and planning functions, not REST endpoints.

## ML prediction interface

Import:

```python
from ml import predict_crop_plan
```

Signature:

```python
predict_crop_plan(
    crop,
    district,
    season=None,
    area_hectares=1.0,
    year=None,
    month=None,
    prediction_date=None,
    market=None,
)
```

Required inputs are `crop` and `district`. Supply a planning `year` and
either a `month`, `season`, or supported `prediction_date`. District and
crop coverage is limited to the categories supported by the trained models.

The returned dictionary includes crop, district, season, year, month,
area, predicted yield in tonnes per hectare, predicted prices, price unit,
status, and limitations. Optional prediction values may be `None`.

Status values documented by the prediction service include `success`,
`partial_success`, and `unsupported_price_unit`. Unsupported crop or district
inputs can raise `ValueError`.

## Planning interfaces

### Prepared options

```python
from optimizer.planning_service import create_crop_plan

create_crop_plan(plots, options, available_water_m3, allowed_crops)
```

- `plots`: dictionaries with `plot_id`, `area_hectares`, and `candidates`.
- `options`: dictionaries with `plot_id`, `crop`, `expected_profit_inr`,
  and `water_required_m3`.
- `available_water_m3`: non-negative water budget.
- `allowed_crops`: permitted crop names.

The result contains `status`, `input_validation`, `optimization`, and
`feasibility` when a plan is produced.

### ML-backed planning

```python
from optimizer.planning_service import create_predicted_crop_plan

create_predicted_crop_plan(
    plots, crop_inputs, district, season, available_water_m3, allowed_crops,
    year=None, month=None, prediction_date=None, market=None
)
```

`crop_inputs` maps crop names to dictionaries containing
`cultivation_cost_inr_per_hectare` and `irrigation_requirement_mm`.
The result also reports unavailable options and prediction context.

## Error and status handling

Consumers must check the returned `status` before using optimization output.
Possible planning outcomes include `success`, `infeasible`, `unavailable`,
and `validation_failed`, depending on the failure point. Validate feasibility
and water usage before presenting a plan as usable.

## Units and limitations

- Yield: tonnes per hectare.
- Price: INR per tonne where a reliable unit is available.
- Water: cubic metres.
- Cultivation cost: INR per hectare.
- Price forecasts are national monthly modal benchmarks, not guaranteed
  local mandi prices or live quotes.
- Prediction limitations must be preserved for downstream users.

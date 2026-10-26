# Crop & Irrigation Planner — Optimization Module

## Purpose
The optimization module selects eligible crops for farm plots to maximize
estimated profit while respecting the available irrigation water budget.

## Main entry points

### 1. Create a crop plan from prepared options
Function: `create_crop_plan`

Inputs:
- `plots`: plot IDs, areas, and eligible candidate crops.
- `options`: expected profit and water requirement for each plot-crop pair.
- `available_water_m3`: total water available for the planning period.
- `allowed_crops`: crops permitted by the planning configuration.

### 2. Create a crop plan using ML predictions
Function: `create_predicted_crop_plan`

Inputs:
- `plots`: plot IDs, areas, and candidate crops.
- `crop_inputs`: cultivation cost per hectare and irrigation requirement in mm.
- `district`: target district.
- `season`: target growing season.
- `available_water_m3`: total water available in cubic metres.
- `allowed_crops`: permitted crops.
- Optional prediction context: `year`, `month`, `prediction_date`, and `market`.

This function uses the prediction adapter to prepare crop options before
running optimization and feasibility validation.

## Water calculation
Water required in cubic metres is calculated as:

`area_hectares * irrigation_requirement_mm * 10`

The irrigation requirement and available-water budget must refer to the
same planning period and compatible assumptions.

## Result interpretation
- `status`: overall result, such as `success` or `infeasible`.
- `optimization`: selected crops, expected profit, water use, and remaining water.
- `feasibility`: independent validation details when a plan is produced.
- `unavailable_options`: candidate options that could not be prepared.
- `district`, `season`, and prediction context: context used for predictions.

A successful optimization result is not a guarantee of actual farm income.
Predictions and illustrative input assumptions should be reviewed before
using a plan for real farming decisions.

## Run project tests
From the project root, with the virtual environment activated:

`python -m pytest -q`

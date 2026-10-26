# crop-irrigation-planner

AI-powered crop selection and irrigation optimization using machine learning and mathematical optimization.

---

# Machine Learning Prediction Module (Member 1)

**Component:** Machine Learning Prediction Engine (Member 1)  
**Target Beneficiaries:** Member 2 (Crop Water & Irrigation Planner), Member 3 (Web UI & Integration API)  
**Geographic Calibrations:** 30 Agricultural Districts of Karnataka State, India  

---

## 1. Overview

This module provides reusable, pre-trained machine learning inference pipelines for Karnataka agriculture:
1. **Karnataka Crop Yield Model:** Trained on district-level historical observations (1997–2019), predicting crop yields in **tonnes per hectare** across 42 crops.
2. **National Market-Price Model:** Trained on monthly modal wholesale benchmarks (2010–2025), predicting prices in **INR per tonne** across 15 agricultural commodities (Sugarcane excluded due to unverified units).
3. **Unified Prediction Service (`ml.predict_crop_plan`):** Seamless interface harmonizing crop taxonomies, inferring seasons/months, and generating JSON-serializable outputs.

### Key Guarantees for Members 2 and 3:
- **No Model Retraining:** Models are serialized in `models/` and loaded into memory once at module import. Predictions execute in milliseconds.
- **Zero Target Leakage:** Strict chronological holdout splits prevent lookahead bias (Yield: 2015–2019 test split; Price: 2022–2025 test split).
- **No Arbitrary Substitutions:** Unseen crops or out-of-region districts raise informative `ValueError` exceptions instead of silently inventing fallback predictions.
- **Unit Transparency:** Raw Sugarcane (₹7 to ₹33,000) and Coconut prices have severe unit mixing in government sources. Sugarcane is excluded from price training, and price prediction returns `None` with status `"unsupported_price_unit"`. Sugarcane yield is fully supported (~83.35 t/ha).

---

## 2. Quickstart: How to Load and Call Both Models

Members 2 and 3 can import directly from the top-level `ml` package without running training scripts.

### 2.1 Unified Crop Planning (Recommended)

Use `predict_crop_plan` to get both expected yield and commodity price in a single call:

```python
from ml import predict_crop_plan

# Example: Maize in Belagavi District (Kharif Season, 4 Hectares)
plan = predict_crop_plan(
    crop="Maize",
    district="BELAGAVI",
    season="Kharif",
    area_hectares=4.0,
    year=2024,
    month=10
)

print(plan)
```

**Output (JSON-Serializable Dictionary):**
```json
{
  "crop": "maize",
  "district": "BELAGAVI",
  "season": "Kharif",
  "year": 2024,
  "month": 10,
  "area_hectares": 4.0,
  "predicted_yield_tonnes_per_hectare": 2.869,
  "predicted_price_per_tonne": 15997.93,
  "predicted_price_per_quintal": 1599.79,
  "price_unit": "INR per tonne (converted from INR per quintal benchmark)",
  "status": "success",
  "limitations": [
    "Model trained exclusively on Karnataka district-level historical observations (1997-2019).",
    "Predictions reflect expected agro-climatic norms; real-time weather anomalies (extreme drought/flood) are not modeled.",
    "Model predicts national monthly modal wholesale benchmarks; it does not capture local mandi auction spreads.",
    "Reflects structural historical price benchmarks and seasonality; not a real-time live trading forecast.",
    "Price per tonne is calculated based on standard Agmarknet INR/quintal alignment (10 quintals = 1 tonne); raw dataset header lacks explicit unit confirmation."
  ]
}
```

---

### 2.2 Standalone Yield Prediction

Use `predict_yield` when only physical crop production estimates are required:

```python
from ml import predict_yield

yield_result = predict_yield(
    crop="Rice",
    district="MYSURU",       # Case-insensitive; older spellings (MYSORE) mapped automatically
    season="Kharif",
    area_hectares=2.5,
    year=2024
)

print(f"Predicted Yield: {yield_result['predicted_yield_tonnes_per_hectare']} tonnes/ha")
print(f"Total Production: {yield_result['estimated_production_tonnes']} tonnes")
```

---

### 2.3 Standalone Market-Price Prediction

Use `predict_price` when estimating commodity wholesale values:

```python
from ml import predict_price

# Positional or keyword calling supported
price_result = predict_price(
    crop="Maize",
    market="Karnataka",      # Optional market note (benchmark uses national monthly modal)
    prediction_date="2024-10" # 'YYYY-MM' or 'YYYY-MM-DD'
)

print(f"Price per Quintal: Rs. {price_result['predicted_price_per_quintal']}")
print(f"Price per Tonne:   Rs. {price_result['predicted_price_per_tonne']}")
```

---

### 2.4 Handling Sugarcane & Unit Volatility

Sugarcane produces high vegetative biomass (~80–120 tonnes/ha). However, raw market price records mix individual stalk prices (₹7) with bulk quintal prices (₹33,000), producing massive historical forecasting error (139.5%). 

The API protects downstream calculations by withholding unreliable prices as `null`:

```python
from ml import predict_crop_plan

cane = predict_crop_plan("Sugarcane", "MANDYA", area_hectares=1.0, year=2024, month=12)

print(cane["predicted_yield_tonnes_per_hectare"])  # ~113.35 t/ha (High yield preserved)
print(cane["predicted_price_per_tonne"])           # None (Price withheld)
print(cane["status"])                              # "unsupported_price_unit"
```

---

### 2.5 Handling Asymmetric Crop Coverage

- **Yield-Only Crops (e.g., Onion, Garlic, Potato):** Covered by Karnataka yield data, but absent from the 16 national market price commodities. Returns `status="partial_success"` with `predicted_price_per_tonne=null`.
- **Price-Only Commodities (e.g., Cotton, Coffee, Tea):** Excluded from yield models because historical production was reported in non-tonne units (bales/nuts). Returns `status="partial_success"` with `predicted_yield_tonnes_per_hectare=null`.

---

### 2.6 Error Handling: Unseen Categories & Invalid Inputs

The module enforces strict validation and raises `ValueError`:

```python
from ml import predict_crop_plan

try:
    # Out-of-region district
    predict_crop_plan("Rice", "JAIPUR", year=2024, month=10)
except ValueError as e:
    print(f"Rejected: {e}")

try:
    # Unsupported crop
    predict_crop_plan("Dragonfruit", "MYSURU", year=2024, month=10)
except ValueError as e:
    print(f"Rejected: {e}")
```

---

## 3. Running Verification & Workflow Tests

### Run the Full Automated Test Suite (39 Tests)
```bash
# Using the project's virtual environment
.\.venv\Scripts\python.exe -m unittest discover tests
```
*Current Status: 39/39 tests passing (100% pass rate).*

### Run the Interactive Workflow Demonstration
```bash
.\.venv\Scripts\python.exe src/test_prediction_workflow.py
```
*Demonstrates all 7 production scenarios: direct yield, direct price, unified plan, high-yield Sugarcane, yield-only Onion, price-only Cotton, and input validation.*

---

## 4. Documentation Links

- **Member 1 Handover Document:** [`docs/MEMBER_1_HANDOVER.md`](file:///c:/Users/Hima/OneDrive/Desktop/crop-irrigation-planner/docs/MEMBER_1_HANDOVER.md) — Comprehensive handover summary across all 5 milestones.
- **Machine Learning Technical Handover:** [`docs/ML_HANDOVER.md`](file:///c:/Users/Hima/OneDrive/Desktop/crop-irrigation-planner/docs/ML_HANDOVER.md) — Detailed engineering guide for model artifacts, functions, and limitations.
- **API & Schema Contract:** [`docs/prediction_api_schema.md`](file:///c:/Users/Hima/OneDrive/Desktop/crop-irrigation-planner/docs/prediction_api_schema.md) — Exhaustive specification of functions, arguments, districts, crops, status codes, and return JSON structures.
- **Model Evaluation Report:** [`docs/model_evaluation.md`](file:///c:/Users/Hima/OneDrive/Desktop/crop-irrigation-planner/docs/model_evaluation.md) — Comprehensive validation report with holdout test metrics ($R^2$, MAE, RMSE), sliced sub-population analyses, and error distributions.
- **Dataset Inventory:** [`docs/dataset_inventory.csv`](file:///c:/Users/Hima/OneDrive/Desktop/crop-irrigation-planner/docs/dataset_inventory.csv) — Audited catalog of raw and cleaned datasets, time horizons, verified units, and known data constraints.

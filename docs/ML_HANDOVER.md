# Machine Learning Handover Document: Prediction Engine

**Project:** Crop & Irrigation Planner (Karnataka Agriculture)  
**Author:** Member 1 (ML & Data Pipeline Specialist)  
**Handover Recipients:** Member 2 (Crop Water & Irrigation Planner), Member 3 (Web UI & Integration API)  
**Date:** October 2026 (Final Verified Handover)  
**Version:** 1.0.0 (Production / Inference Ready)  

---

## 1. Executive Summary

This handover document provides a comprehensive operational guide to the Machine Learning Prediction Engine. The engine provides pre-trained, zero-leakage predictive pipelines for:
1. **Karnataka District-Level Crop Yield Estimation** (42 crops across Karnataka's 30 agricultural districts).
2. **National Monthly Modal Market-Price Forecasting** (15 verified commodities, with Sugarcane price safely withheld).
3. **Unified Planning Service** harmonizing crop names, seasons, and months into the agreed standard JSON schema.

---

## 2. Final Model Artifacts & File Structure

```text
crop-irrigation-planner/
├── models/
│   ├── yield_model.joblib          # Scikit-learn Pipeline (RF Regressor, 42 crops, R²=0.926)
│   ├── price_model.joblib          # Scikit-learn Pipeline (RF Regressor, 15 commodities, R²=0.528)
│   └── price_model_metadata.json   # Deserialization and training provenance metadata
├── ml/
│   ├── __init__.py                 # Top-level exports: predict_yield, predict_price, predict_crop_plan
│   ├── yield_prediction.py         # Standalone yield model loader and validation logic
│   ├── price_prediction.py         # Standalone price model loader and unit handling logic
│   └── prediction_service.py       # Unified orchestration, crop cross-mapping, and seasonal inference
├── docs/
│   ├── ML_HANDOVER.md              # This technical handover document
│   ├── MEMBER_1_HANDOVER.md        # Comprehensive project handover summary
│   ├── prediction_api_schema.md    # Detailed API schema contract for Members 2 and 3
│   ├── model_evaluation.md         # Consolidated model evaluation report with verified metrics
│   └── dataset_inventory.csv       # Audit of raw and processed datasets
├── src/
│   ├── train_yield_model.py        # Yield model training pipeline
│   ├── train_price_model.py        # Price model training pipeline (Sugarcane excluded)
│   ├── check_yield_model.py        # Yield evaluation and holdout verification script
│   ├── check_price_model.py        # Price evaluation and holdout verification script
│   └── test_prediction_workflow.py # Interactive CLI demonstrating all 7 prediction workflows
└── tests/
    ├── test_prediction_models.py    # 13 unit tests for yield and price model boundaries
    ├── test_prediction_service.py   # 12 unit tests for shared service and inference rules
    └── test_ml_prediction_workflow.py # 14 unit tests for production ml package and JSON schemas
```

---

## 3. Reusable Prediction Functions

### 3.1 `ml.predict_crop_plan` (Recommended Unified Interface)
```python
from ml import predict_crop_plan

plan = predict_crop_plan(
    crop="Maize",
    district="BELAGAVI",
    season="Kharif",
    area_hectares=4.0,
    year=2024,
    month=10
)
```

**Output Schema:**
```json
{
  "crop": "maize",
  "district": "BELAGAVI",
  "season": "Kharif",
  "year": 2024,
  "month": 10,
  "area_hectares": 4.0,
  "predicted_yield_tonnes_per_hectare": 2.869,
  "predicted_price_per_tonne": 15997.75,
  "predicted_price_per_quintal": 1599.78,
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

### 3.2 `ml.predict_yield` (Standalone Yield)
```python
from ml import predict_yield

res = predict_yield(
    crop="Rice",
    district="MYSURU",
    season="Kharif",
    area_hectares=2.5,
    year=2024
)
# Returns: predicted_yield_tonnes_per_hectare: 2.804, estimated_production_tonnes: 7.01
```

### 3.3 `ml.predict_price` (Standalone Market Price)
```python
from ml import predict_price

# Positional or keyword calling supported
res = predict_price("Maize", "Karnataka", "2024-10")
# Returns: predicted_price_per_tonne: 15997.75, predicted_price_per_quintal: 1599.78
```

---

## 4. Sugarcane Price Handling

- **Issue:** Historical Agmarknet market price data for Sugarcane contains severe unit mixing (entries ranging from ₹7 to ₹33,000), producing an extreme 139.5% relative error on historical holdouts.
- **Action Taken:** Sugarcane was **strictly excluded from price model training and evaluation**.
- **Yield Model:** Sugarcane remains **fully supported** in the yield model (~83.35 t/ha fresh biomass).
- **Price Response:** When price is requested for Sugarcane, the API returns:
  - `predicted_price_per_tonne: null`
  - `predicted_price_per_quintal: null`
  - `price_unit: null`
  - `status: "unsupported_price_unit"`
  - An explicit limitation advisory warning downstream systems not to compute revenue with arbitrary prices.

---

## 5. Verified Evaluation Metrics

Every reported metric below has been verified by executing [`src/check_yield_model.py`](file:///c:/Users/Hima/OneDrive/Desktop/crop-irrigation-planner/src/check_yield_model.py) and [`src/check_price_model.py`](file:///c:/Users/Hima/OneDrive/Desktop/crop-irrigation-planner/src/check_price_model.py):

### 5.1 Karnataka Yield Model (Temporal Holdout: 2015–2019)
- **Training Set:** 19,514 records (1997–2014)
- **Holdout Test Set:** 6,429 records (2015–2019)
- **Overall MAE:** **1.207 tonnes / hectare**
- **Overall RMSE:** **3.443 tonnes / hectare**
- **Overall $R^2$:** **0.926**
- **Non-Sugarcane Sliced MAE (6,298 records):** **0.949 t/ha** (Rel Error: **31.3%**, $R^2$: **0.766**)
- **Sugarcane Sliced MAE (131 records):** **13.642 t/ha** (Rel Error: **16.4%**, $R^2$: **0.143**)
- **Top Crop Errors:** Rice: 0.423 t/ha (15.3%); Maize: 0.723 t/ha (22.2%); Groundnut: 0.247 t/ha (25.8%); Ragi: 0.285 t/ha (18.5%).

### 5.2 Market Price Model (Temporal Holdout: 2022–2025, Sugarcane Excluded)
- **Training Set:** 2,101 records (2010-01 to 2021-12 across 15 commodities)
- **Holdout Test Set:** 545 records (2022-01 to 2025-03)
- **Baseline 1 (Historical Crop Mean):** MAE: ₹2,057.74 | RMSE: ₹3,121.28 | $R^2$: 0.499
- **Baseline 2 (Seasonal Crop-Month Mean):** MAE: ₹2,063.38 | RMSE: ₹3,153.12 | $R^2$: 0.489
- **Random Forest Model:** MAE: **₹1,585.48** | RMSE: **₹3,028.80** | $R^2$: **0.528**
- **Value Added:** **+23.0% MAE reduction** over historical mean baseline.
- **Top Commodity Errors:** Sugar: ₹360.35 (9.1%); Groundnut: ₹637.16 (10.5%); Sunflower: ₹750.48 (14.9%); Millets: ₹450.17 (15.2%); Rice: ₹493.12 (15.3%); Cotton: ₹1,477.29 (19.5%); Wheat: ₹580.93 (24.0%); Maize: ₹570.75 (27.0%).

---

## 6. Known Limitations

1. **National vs. District Price Resolution:** Market prices represent national modal wholesale benchmarks (`district_name = "All"`). The model does not capture intra-state APMC mandi basis spreads within Karnataka.
2. **Unverified Source Units in Raw Data:** Raw Agmarknet CSV lacks explicit unit header tags. Values align standardly with INR/quintal, but price-per-tonne conversion ($10 \times \text{quintal}$) is an unverified standard alignment.
3. **Agro-Climatic Normal Yields:** Yield predictions reflect historical district norms and do not model real-time extreme in-season weather shocks (catastrophic drought or flash flooding).
4. **Asymmetric Crop Support:**
   - Yield-Only Crops (e.g., Onion, Garlic): Yield predicted, price is `null`.
   - Price-Only Commodities (e.g., Cotton, Coffee): Price predicted, yield is `null` (historical production was in non-tonne units).

---

## 7. Setup & Test Verification Instructions

### 7.1 Virtual Environment & Dependencies
```powershell
# Virtual environment setup
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```
Key dependencies: `scikit-learn==1.9.1`, `pandas==3.0.6`, `numpy==2.5.4`, `joblib==1.6.0`.

### 7.2 Run Full Test Suite (39 Tests)
```powershell
.\.venv\Scripts\python.exe -m unittest discover tests
```
*Current Result: 39/39 tests passing (100% pass rate).*

### 7.3 Run Workflow Demonstration
```powershell
.\.venv\Scripts\python.exe src/test_prediction_workflow.py
```
*Demonstrates all 7 production inference workflows.*

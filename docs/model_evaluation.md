# Crop & Irrigation Planner: Model Evaluation & Performance Report

**Component:** Machine Learning Prediction Engine (Yield & Market Price)  
**Author:** Member 1 (ML / Data Pipeline Specialist)  
**Date:** October 2026 (Final Verified Handover)  
**Artifact Directory:** [`models/`](file:///c:/Users/Hima/OneDrive/Desktop/crop-irrigation-planner/models/)  
**Code Package:** [`ml/`](file:///c:/Users/Hima/OneDrive/Desktop/crop-irrigation-planner/ml/)  

---

## 1. Executive Summary

This document consolidates the empirically verified performance, evaluation methodology, holdout test metrics, sliced sub-population analyses, and documented limitations for both predictive models in the Crop & Irrigation Planner:
1. **Karnataka Crop Yield Model** ([`models/yield_model.joblib`](file:///c:/Users/Hima/OneDrive/Desktop/crop-irrigation-planner/models/yield_model.joblib))
2. **National Market-Price Model** ([`models/price_model.joblib`](file:///c:/Users/Hima/OneDrive/Desktop/crop-irrigation-planner/models/price_model.joblib))

### Core Integrity Safeguards:
- **Zero Target Leakage & Lookahead Bias:** Both models enforce strict chronological train/test holdouts. No test-split records or future time periods were accessible during training.
- **Distinction Between Test Pass and Accuracy:** The 39 automated unit tests confirm that code interfaces, inputs, and schemas execute as designed; separate statistical holdout evaluations confirm actual prediction errors.
- **No Arbitrary Category Substitution:** Unrepresented districts or crops raise informative `ValueError` exceptions; neither model silently substitutes default values.
- **Sugarcane Price Inaccuracy Resolution:** Due to severe unit mixing in raw data (₹7 to ₹33,000) that produced a 139.5% relative error on historical holdouts, Sugarcane has been **strictly excluded from price model training and evaluation**. Sugarcane remains fully supported in the yield model (~83.35 t/ha fresh biomass), while market price requests return `None` with explicit status `"unsupported_price_unit"`.

---

## 2. Crop Yield Model Evaluation

### 2.1 Model Architecture & Pipeline
- **Algorithm:** Scikit-Learn `Pipeline` with `ColumnTransformer` and `RandomForestRegressor(n_estimators=100, random_state=42, min_samples_leaf=2)`.
- **Preprocessors:** `OneHotEncoder(handle_unknown="ignore")` for categorical columns (`District`, `Crop`, `Season`); `SimpleImputer(strategy="median")` for numerical features (`Year_start`, `Area`).
- **Features Used:** `["District", "Crop", "Year_start", "Season", "Area"]`.
- **Target Variable:** `Yield_tonnes_per_hectare` (tonnes/hectare).
- **Target Leakage Prevention:** `Production` and total `Yield` were strictly excluded from input features.

### 2.2 Temporal Holdout Split (Zero-Leakage Design)
- **Dataset Source:** `data/processed/yield_training_data.csv` (25,943 total valid rows across 30 Karnataka agricultural districts, 1997–2019).
- **Training Set:** 19,514 records spanning historical years **1997 to 2014** (75.2% of dataset).
- **Holdout Test Set:** 6,429 records spanning recent unseen years **2015 to 2019** (24.8% of dataset).
- **Split Rule:** Strict chronological split on starting agricultural year (`Year_start < 2015` vs `Year_start >= 2015`).

### 2.3 Overall Holdout Metrics
*Verified by running [`src/check_yield_model.py`](file:///c:/Users/Hima/OneDrive/Desktop/crop-irrigation-planner/src/check_yield_model.py):*

| Metric | Verified Value | Reference / Units | Status |
| :--- | :---: | :--- | :---: |
| **Mean Absolute Error (MAE)** | **1.207** | tonnes / hectare | Verified |
| **Root Mean Squared Error (RMSE)** | **3.443** | tonnes / hectare | Verified |
| **Coefficient of Determination ($R^2$)** | **0.926** | Explains 92.6% of test variance across 42 crops | Verified |

### 2.4 Sliced Evaluation: High-Biomass Sugarcane vs. Non-Sugarcane Crops
Sugarcane yields fresh vegetative stalk biomass (~80–120 tonnes/ha), whereas grain and pulse crops yield dry seed grains (~0.5–5.0 tonnes/ha). Pooling both obscures grain performance:

| Sliced Category | Test Records ($N$) | Mean Actual Yield | Holdout MAE | Holdout RMSE | Relative Error (%) | $R^2$ Score |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Non-Sugarcane Crops (41 crops)** | 6,298 | 3.029 t/ha | **0.949 t/ha** | 2.376 t/ha | **31.3%** | 0.766 |
| **Sugarcane (High-Biomass)** | 131 | 83.350 t/ha | **13.642 t/ha** | 17.619 t/ha | **16.4%** | 0.143 |

### 2.5 Representative Per-Crop Holdout Performance (Top 10 by Frequency)
*Verified on 2015–2019 holdout test records:*

| Crop | Test Records ($N$) | Mean Actual (t/ha) | Holdout MAE (t/ha) | Holdout RMSE (t/ha) | Relative Error (%) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Maize** | 405 | 3.26 | **0.723** | 1.000 | **22.2%** |
| **Rice** | 343 | 2.76 | **0.423** | 0.561 | **15.3%** |
| **Groundnut** | 265 | 0.96 | **0.247** | 0.311 | **25.8%** |
| **Ragi** | 274 | 1.54 | **0.285** | 0.406 | **18.5%** |
| **Jowar** | 280 | 1.27 | **0.362** | 0.476 | **28.5%** |
| **Sunflower** | 269 | 0.76 | **0.261** | 0.366 | **34.2%** |
| **Dry chillies** | 276 | 1.86 | **0.485** | 0.876 | **26.0%** |
| **Cowpea(Lobia)**| 337 | 0.35 | **0.148** | 0.192 | **42.4%** |
| **Horse-gram** | 259 | 0.53 | **0.228** | 0.382 | **42.9%** |
| **Onion** | 354 | 10.03 | **4.711** | 5.559 | **46.9%** |

---

## 3. Market-Price Model Evaluation

### 3.1 Model Architecture & Pipeline
- **Algorithm:** Scikit-Learn `Pipeline` with `ColumnTransformer` and `RandomForestRegressor(n_estimators=100, random_state=42, min_samples_leaf=2)`.
- **Preprocessors:** `OneHotEncoder(handle_unknown="ignore")` on `commodity_name`; numerical passthrough for `year` and `month_num`.
- **Features Used:** `["commodity_name", "year", "month_num"]`.
- **Target Variable:** `avg_modal_price` (modal auction price in INR/quintal).
- **Target Leakage Prevention:** Same-month `avg_min_price`, `avg_max_price`, and `change` were strictly excluded.
- **Sugarcane Exclusion:** Sugarcane (154 rows) was strictly excluded from training and evaluation.

### 3.2 Temporal Holdout Split
- **Dataset Source:** `data/processed/price_training_data.csv` filtered to the 15 verified commodities (2,646 clean monthly observations, 2010–2025).
- **Training Set:** 2,101 records spanning **2010-01 to 2021-12** (79.4% of dataset).
- **Holdout Test Set:** 545 records spanning **2022-01 to 2025-03** (20.6% of dataset).

### 3.3 Overall Holdout Metrics vs. Baselines
*Verified by running [`src/check_price_model.py`](file:///c:/Users/Hima/OneDrive/Desktop/crop-irrigation-planner/src/check_price_model.py):*

| Method / Paradigm | MAE (INR) | RMSE (INR) | $R^2$ | Value Added vs Baseline | Status |
| :--- | :---: | :---: | :---: | :--- | :---: |
| **Baseline 1: Crop Historical Mean** | 2,057.74 | 3,121.28 | 0.499 | Historical average per crop from training period | Verified |
| **Baseline 2: Seasonal Crop-Month Mean** | 2,063.38 | 3,153.12 | 0.489 | Captures month-of-year seasonality | Verified |
| **Random Forest Model (Calendar Profile)** | **1,585.48** | **3,028.80** | **0.528** | **+23.0% MAE improvement** over historical mean | Verified |
| *Reference: Lag-1 Persistence Baseline* | *292.70* | *759.35* | *0.970* | *Autoregressive benchmark (requires $P_{t-1}$)* | Verified |

### 3.4 Sliced Performance: Standard Field Crops vs. Unit-Volatile Coconut
| Crop Slice | Test Records ($N$) | Mean Actual Price | Baseline MAE | Model MAE | Relative Error (%) | Model $R^2$ | MAE Improvement |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Standard Field Crops (14 crops)** | 506 | ₹5,623.87 | ₹1,923.77 | **₹1,577.53** | **28.1%** | **0.543** | **+18.0%** |
| **Unit-Volatile Coconut (1 crop)** | 39 | ₹4,137.14 | ₹3,795.86 | **₹1,688.65** | **40.8%** | -8.941 | +55.5% |

### 3.5 Commodity-Specific Evaluation Breakdown (All 15 Trained Commodities)
*Verified on 2022-01 to 2025-03 holdout period:*

| Commodity | Test Records ($N$) | Mean Actual (INR) | Baseline MAE (INR) | Model MAE (INR) | Model RMSE (INR) | Rel Error (%) | Reliability Assessment |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Sugar** | 39 | ₹3,950.19 | ₹471.84 | **₹360.35** | ₹404.90 | **9.1%** | **Excellent** |
| **Groundnut** | 39 | ₹6,078.14 | ₹1,810.31 | **₹637.16** | ₹767.05 | **10.5%** | **Excellent** |
| **Sunflower** | 39 | ₹5,025.21 | ₹1,574.10 | **₹750.48** | ₹958.56 | **14.9%** | **Very Good** |
| **Millets** | 39 | ₹2,961.45 | ₹1,297.09 | **₹450.17** | ₹559.99 | **15.2%** | **Very Good** |
| **Rice** | 39 | ₹3,220.70 | ₹710.00 | **₹493.12** | ₹559.87 | **15.3%** | **Very Good** |
| **Cotton** | 39 | ₹7,565.86 | ₹2,984.96 | **₹1,477.29** | ₹1,866.69 | **19.5%** | **Good** |
| **Wheat** | 39 | ₹2,422.78 | ₹802.81 | **₹580.93** | ₹627.07 | **24.0%** | **Good** |
| **Barley (Jau)**| 39 | ₹2,241.71 | ₹847.08 | **₹550.17** | ₹624.47 | **24.5%** | **Good** |
| **Maize** | 39 | ₹2,112.50 | ₹770.63 | **₹570.75** | ₹594.90 | **27.0%** | **Good** |
| **Turmeric** | 39 | ₹9,612.40 | ₹2,912.76 | **₹2,957.24** | ₹3,752.48 | **30.8%** | **Moderate** |
| **Jowar(Sorghum)**| 39 | ₹2,944.02 | ₹1,100.25 | **₹1,011.87** | ₹1,142.71 | **34.4%** | **Moderate** |
| **Ginger(Dry)**| 39 | ₹7,848.04 | ₹3,287.99 | **₹3,473.33** | ₹4,529.82 | **44.3%** | **High Volatility** |
| **Coffee** | 37 | ₹17,171.44 | ₹6,589.51 | **₹7,495.57** | ₹9,178.55 | **43.7%** | **Global Supply Shock** |
| **Coconut** | 39 | ₹4,137.14 | ₹3,795.86 | **₹1,688.65** | ₹2,317.39 | **40.8%** | **Unit Volatile (Copra/Nuts)** |
| **Tea** | 1 | ₹27,000.00 | ₹5,393.41 | **₹1,693.81** | ₹1,693.81 | **6.3%** | **Single Observation** |
| **Sugarcane** | — | — | — | **EXCLUDED** | — | — | **Price Withheld (`None`)** |

---

## 4. Key Limitations & Risk Management

1. **Sugarcane Price Inaccuracy Resolution:**
   - Raw market price records span from ₹7 (single stalks) to ₹33,000 (bulk jaggery), yielding an invalid distribution and 139.5% error on holdouts.
   - **Resolution:** Sugarcane is excluded from the trained model pipeline and returns `None` with `status = "unsupported_price_unit"`. Sugarcane yield is fully supported (~83.35 t/ha).
2. **Unverified Source Units in Raw Price Data:**
   - Raw CSV header lacks explicit unit tags. While values match standard Agmarknet INR/quintal benchmarks, conversion to price-per-tonne ($10 \times \text{quintal}$) is clearly documented with an advisory.
3. **National vs. District Price Granularity:**
   - Market prices are national monthly averages (`district_name = "All"`). The model cannot predict local APMC mandi price spreads within Karnataka.
4. **Historical Price Profile vs. Future Time-Series Forecasting:**
   - The model predicts the structural expected price profile for multi-year crop planning months in advance. It is not an autoregressive live trading forecast and cannot anticipate unpredictable geopolitical or climate shocks.

---

## 5. Verification & Automated Test Suite

Continuous testing distinguishes model execution tests from prediction accuracy:

1. **Model Testing Suite** ([`tests/test_prediction_models.py`](file:///c:/Users/Hima/OneDrive/Desktop/crop-irrigation-planner/tests/test_prediction_models.py)): 13 unit tests verifying input validation, finite predictions, unit bounds, Sugarcane high-biomass behavior, holdout ground truth comparisons, and strict error raising for unrepresented districts and crops.
2. **Service Interface Suite** ([`tests/test_prediction_service.py`](file:///c:/Users/Hima/OneDrive/Desktop/crop-irrigation-planner/tests/test_prediction_service.py)): 12 unit tests verifying schema keys, dual crop alignment, season/month inference, alias equivalence, and Sugarcane/Coconut price withholding.
3. **Workflow Integration Suite** ([`tests/test_ml_prediction_workflow.py`](file:///c:/Users/Hima/OneDrive/Desktop/crop-irrigation-planner/tests/test_ml_prediction_workflow.py)): 14 unit tests validating the production `ml` package, positional signatures (`predict_price(crop, market, prediction_date)`), strict agreed JSON schema compliance, and end-to-end `json.dumps()` serialization.

**Total Tests:** 39 tests passing cleanly across the test suite ($100\%$ pass rate).

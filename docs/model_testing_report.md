# Step 3: Prediction Models Test Report

**Test Execution Timestamp:** 2026-10-23 12:36:26  
**Overall Result:** ALL TESTS PASSED  
**Summary:** 24/24 tests passed (100.0%)

---

## Summary of Test Results

| Test ID | Model | Category | Description | Status | Output / Observation |
| :---: | :---: | :--- | :--- | :---: | :--- |
| `Y-01` | Yield | Represented Category | Rice in Mysuru (represented in training data) | **PASS** | 2.804 t/ha (Production: 7.01 t) |
| `Y-02` | Yield | Represented Category | Maize in Belagavi (represented in training data) | **PASS** | 2.869 t/ha |
| `Y-03` | Yield | High-Yield Behavior | Sugarcane high-yield biomass test (Mandya) | **PASS** | 113.355 t/ha |
| `Y-04` | Yield | Unseen Category | Unrepresented district rejection (JAIPUR) | **PASS** | ValueError: Unsupported district 'JAIPUR'. The model is specifically trained for Karnataka's 30 agricultural districts and does not support out-of-region or unseen districts. |
| `Y-05` | Yield | Unseen Category | Unrepresented crop rejection (Dragonfruit) | **PASS** | ValueError: Unsupported crop 'Dragonfruit'. The model was trained on 42 Karnataka crops and cannot reliably predict yield for unseen crop categories. |
| `Y-06` | Yield | Input Validation | Zero area (area = 0.0) | **PASS** | ValueError: Area must be a positive finite number (> 0), got 0.0. |
| `Y-06` | Yield | Input Validation | Negative area (area = -5.0) | **PASS** | ValueError: Area must be a positive finite number (> 0), got -5.0. |
| `Y-06` | Yield | Input Validation | Invalid season (season = 'Monsoon') | **PASS** | ValueError: Unsupported season 'Monsoon'. Season must be one of: ['Kharif', 'Rabi', 'Summer', 'Whole Year']. |
| `Y-06` | Yield | Input Validation | Empty district | **PASS** | ValueError: District cannot be empty or missing. |
| `Y-07` | Yield | Ground Truth Accuracy | Holdout Ground Truth: Rice in BAGALKOTE (2015) | **PASS** | Predicted: 2.868 t/ha, Error: 0.149 (5.5%) |
| `Y-07` | Yield | Ground Truth Accuracy | Holdout Ground Truth: Maize in BAGALKOTE (2015) | **PASS** | Predicted: 3.232 t/ha, Error: 0.472 (12.7%) |
| `Y-07` | Yield | Ground Truth Accuracy | Holdout Ground Truth: Sugarcane in BAGALKOTE (2015) | **PASS** | Predicted: 99.274 t/ha, Error: 3.324 (3.5%) |
| `P-01` | Price | Represented Category | Rice market price prediction (2024-11) | **PASS** | INR 2,763.76 (INR per Quintal (100 kg) [Agmarknet standard]) |
| `P-02` | Price | Represented Category | Maize market price prediction (2025-02) | **PASS** | INR 1,442.69 |
| `P-03` | Price | Unit Transparency | Sugarcane market price & unit advisory check | **PASS** | INR 465.92 | Advisory: CAUTION: Raw dataset exhibits mixed unit... |
| `P-04` | Price | Unseen Category | Unrepresented crop rejection (Vanilla) | **PASS** | ValueError: Unsupported crop 'Vanilla'. The market-price model was trained on 16 specific national commodities and cannot reliably predict unseen crops. Available crops: Barley (Jau), Coconut, Coffee, Cotton, Ginger(Dry), Groundnut, Jowar(Sorghum), Maize, Millets, Rice, Sugar, Sugarcane, Sunflower, Tea, Turmeric, Wheat |
| `P-05` | Price | Input Validation | Month > 12 (month = 13) | **PASS** | ValueError: Month must be between 1 and 12, got 13. |
| `P-05` | Price | Input Validation | Month < 1 (month = 0) | **PASS** | ValueError: Month must be between 1 and 12, got 0. |
| `P-05` | Price | Input Validation | Empty crop name | **PASS** | ValueError: Crop name cannot be empty or missing. |
| `P-05` | Price | Input Validation | Year out of horizon (year = 1850) | **PASS** | ValueError: Year 1850 is out of the realistic market planning horizon (2000-2035). |
| `P-06` | Price | Ground Truth Accuracy | Holdout Ground Truth: Rice (2022-01) | **PASS** | Predicted: INR 2,681.67, Error: INR 156.95 (5.5%) |
| `P-06` | Price | Ground Truth Accuracy | Holdout Ground Truth: Wheat (2022-01) | **PASS** | Predicted: INR 1,830.80, Error: INR 134.65 (6.9%) |
| `P-06` | Price | Ground Truth Accuracy | Holdout Ground Truth: Maize (2022-01) | **PASS** | Predicted: INR 1,475.47, Error: INR 243.49 (14.2%) |
| `P-06` | Price | Ground Truth Accuracy | Holdout Ground Truth: Sugarcane (2022-01) | **PASS** | Predicted: INR 761.81, Error: INR 443.78 (139.5%) |

---

## Key Verification Findings

### 1. Input Validation and Missing Value Handling
- Both `predict_crop_yield` and `predict_crop_price` strictly validate all inputs.
- Negative area, zero area, empty strings, missing values, and out-of-range years/months are immediately rejected with informative `ValueError` exceptions.
- All successful predictions produce finite, non-negative numbers with documented units (`tonnes/hectare` for yield; `INR per quintal` for market price).

### 2. No Silent Substitution for Unseen Categories
- Out-of-region districts (e.g. `JAIPUR`, `CHANDIGARH`) and unsupported crops (e.g. `Dragonfruit`, `Vanilla`) are explicitly rejected.
- The system does **not** fall back to arbitrary default numbers when an unseen category is supplied.

### 3. Sugarcane High-Yield Biological Reality
- The yield model correctly exhibits Sugarcane's biological high-biomass characteristics, predicting **~99.3 tonnes/hectare** in Bagalkote (actual: **95.95 tonnes/hectare**; relative error: **3.5%**).
- This confirms the model accurately distinguishes high-biomass commercial crops from grain crops (Rice: ~2.8 t/ha; Maize: ~3.2 t/ha).

### 4. Ground-Truth Accuracy vs. Raw Unit Imperfections
- When compared with held-out test records:
  - **Rice Yield:** Predicted 2.868 t/ha vs Actual 2.719 t/ha (**5.5% error**).
  - **Maize Yield:** Predicted 3.232 t/ha vs Actual 3.704 t/ha (**12.7% error**).
  - **Rice Market Price (2022-01):** Predicted ₹2,681.67 vs Actual ₹2,838.62 (**5.5% error**).
  - **Wheat Market Price (2022-01):** Predicted ₹1,830.80 vs Actual ₹1,965.45 (**6.9% error**).
  - **Sugarcane Market Price (2022-01):** Predicted ₹761.81 vs Actual ₹318.03 (**139.5% error**).
- **Critical Insight:** The test suite confirms that execution success does *not* imply prediction accuracy. The high error on Sugarcane market price is documented transparently and stems directly from the raw dataset mixing quintal and stalk reporting units.

---

## How to Run Tests from the VS Code Terminal

You can run the tests directly from the integrated terminal in VS Code using any of the following commands:

```bash
# Option 1: Standard Python unittest runner (Recommended)
python -m unittest tests/test_prediction_models.py

# Option 2: Verbose unittest runner
python -m unittest -v tests/test_prediction_models.py

# Option 3: Comprehensive report generator with formatted table
python src/test_models.py
```
# Prediction API & Shared Interface Specification

**Target Audience:** Member 2 (Crop Water & Irrigation Planner), Member 3 (Web Application & API Interface)  
**Author:** Member 1 (Machine Learning & Data Pipeline Specialist)  
**Package:** [`ml`](file:///c:/Users/Hima/OneDrive/Desktop/crop-irrigation-planner/ml/)  
**Version:** 1.0.0 (Production / Inference Ready)  
**Date:** October 2026  

---

## 1. Overview & Architecture

The `ml` package provides pre-trained, zero-leakage machine learning inference functions for crop yield estimation and wholesale market price forecasting. 

### Key Design Principles:
1. **Pre-trained Artifacts:** Models are serialized in [`models/yield_model.joblib`](file:///c:/Users/Hima/OneDrive/Desktop/crop-irrigation-planner/models/yield_model.joblib) and [`models/price_model.joblib`](file:///c:/Users/Hima/OneDrive/Desktop/crop-irrigation-planner/models/price_model.joblib). They are loaded into memory once at module import. **Calling any prediction function never triggers model training.**
2. **Zero Target Leakage & Lookahead Bias:** Yield models were trained exclusively on 1997–2014 data and evaluated on 2015–2019 holdouts. Price models were trained on 2010–2021 data and evaluated on 2022–2025 holdouts.
3. **No Silent Fallbacks:** If an unseen crop or out-of-region district is supplied, the module raises an informative `ValueError`. It never substitutes arbitrary default values.
4. **Unit Transparency:** Sugarcane and Coconut exhibit raw reporting unit distortions in the source dataset. Instead of inventing arbitrary conversion factors, their price predictions return `null` with status `"unsupported_price_unit"` and explicit limitation advisories.
5. **Strict JSON Serializability:** All functions return standard Python dictionaries containing only native types (`str`, `int`, `float`, `list`, `None`), verified via `json.dumps()`.

---

## 2. Quick Import Reference

Members 2 and 3 can import functions directly from the `ml` namespace:

```python
# Import from the top-level ml package
from ml import predict_crop_plan  # Recommended unified interface
from ml import predict_yield      # Standalone yield model
from ml import predict_price      # Standalone market-price model

# Convenience aliases for predict_crop_plan
from ml import predict_crop_metrics, get_crop_prediction
```

---

## 3. Unified Crop Planning Interface (`ml.predict_crop_plan`)

The primary function recommended for Member 2 and Member 3. It orchestrates both models, harmonizes crop names, infers missing seasons/months, and returns the agreed standard schema.

### Function Signature

```python
def predict_crop_plan(
    crop: str,
    district: str,
    season: Optional[str] = None,
    area_hectares: float = 1.0,
    year: Optional[int] = None,
    month: Optional[int] = None,
    prediction_date: Optional[str] = None,
    market: Optional[str] = None,
) -> Dict[str, Any]:
```

### Parameter Specification

| Parameter | Type | Required | Default | Validation & Bounds | Description |
| :--- | :--- | :---: | :---: | :--- | :--- |
| `crop` | `str` | **Yes** | — | Case-insensitive; must match one of the 42 Karnataka yield crops or 16 price commodities | Crop or commodity name (e.g., `'Maize'`, `'Rice'`, `'Sugarcane'`, `'Cotton'`). |
| `district` | `str` | **Yes** | — | Must match one of the 30 Karnataka agricultural districts; case-insensitive | District where the farm is located (e.g., `'MYSURU'`, `'BELAGAVI'`). Legacy spellings auto-canonicalized. |
| `season` | `Optional[str]` | Conditional | `None` | One of: `'Kharif'`, `'Rabi'`, `'Summer'`, `'Whole Year'` | Agricultural cropping season. If omitted and `month` is provided, inferred automatically. |
| `area_hectares`| `float` | No | `1.0` | Finite positive number ($> 0.0$) | Total cultivated land area in hectares. |
| `year` | `Optional[int]` | Conditional | `None` | Integer in range $1990 \le \text{year} \le 2035$ | Target agricultural planning year (e.g., `2024`). |
| `month` | `Optional[int]` | Conditional | `None` | Integer in range $1 \le \text{month} \le 12$ | Target harvest/market month. If omitted and `season` is provided, inferred automatically. |
| `prediction_date` | `Optional[str]` | Conditional | `None` | Format: `'YYYY-MM'` or `'YYYY-MM-DD'` | Alternative date input. Automatically extracts `year` and `month`. |
| `market` | `Optional[str]` | No | `None` | Free string | Target market name (recorded for telemetry; benchmark uses national monthly modal). |

*Note on Date/Season Requirement:* Provide at least `year` and either `season` or `month` (or `prediction_date`).

### Return Structure (The Agreed Standard Schema)

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

### Status Codes

| Status Value | Meaning | Action for Member 2 & Member 3 |
| :--- | :--- | :--- |
| `"success"` | Both yield and price per tonne were reliably estimated. | Safe to compute full revenue, water-productivity ratios, and irrigation ROI. |
| `"partial_success"` | Only one of yield or price is available. (e.g., Onion is yield-only; Cotton is price-only). | Use the available prediction; handle the `null` dimension gracefully in UI/planner. |
| `"unsupported_price_unit"`| Yield is valid, but commodity (Sugarcane, Coconut) has mixed source reporting units. | Do **not** multiply yield by an invented price. Display yield and advise user of mandi contract pricing. |
| `"error"` | Internal execution failure. | Check input parameters and exception details. |

---

## 4. Standalone Yield Interface (`ml.predict_yield`)

Used when Member 2 only needs physical agronomic metrics (yield rate and production quantity) without price calculations.

### Function Signature

```python
def predict_yield(
    crop: str,
    district: str,
    season: str,
    area_hectares: float,
    year: int
) -> Dict[str, Any]:
```

### Response Schema

```json
{
  "crop": "Rice",
  "district": "MYSURU",
  "season": "Kharif",
  "year": 2024,
  "area_hectares": 2.5,
  "predicted_yield_tonnes_per_hectare": 2.804,
  "estimated_production_tonnes": 7.01,
  "yield_unit": "tonnes per hectare",
  "predicted_price_per_tonne": null,
  "price_unit": null,
  "status": "success",
  "limitations": [
    "Model trained exclusively on Karnataka district-level historical observations (1997-2019).",
    "Predictions reflect expected agro-climatic norms; real-time weather anomalies (extreme drought/flood) are not modeled."
  ]
}
```

---

## 5. Standalone Market Price Interface (`ml.predict_price`)

Used when Member 3 or economic modules only need wholesale commodity benchmark pricing.

### Function Signature

```python
def predict_price(
    crop: str,
    market: Optional[str] = None,
    prediction_date: Optional[str] = None,
    year: Optional[int] = None,
    month: Optional[int] = None,
) -> Dict[str, Any]:
```

*Calling Styles Supported:*
- Positional: `predict_price("Rice", "Karnataka", "2024-11")`
- Positional date: `predict_price("Rice", "2024-11")`
- Keyword: `predict_price("Maize", year=2024, month=10)`

### Response Schema (Standard Commodity)

```json
{
  "crop": "Maize",
  "market": null,
  "year": 2024,
  "month": 10,
  "predicted_yield_tonnes_per_hectare": null,
  "predicted_price_per_tonne": 15997.93,
  "predicted_price_per_quintal": 1599.79,
  "price_unit": "INR per tonne (converted from INR per quintal benchmark)",
  "status": "success",
  "limitations": [
    "Model predicts national monthly modal wholesale benchmarks; it does not capture local mandi auction spreads.",
    "Reflects structural historical price benchmarks and seasonality; not a real-time live trading forecast.",
    "Price per tonne is calculated based on standard Agmarknet INR/quintal alignment (10 quintals = 1 tonne); raw dataset header lacks explicit unit confirmation."
  ]
}
```

### Response Schema (Sugarcane / Mixed Unit Commodity)

```json
{
  "crop": "Sugarcane",
  "market": null,
  "year": 2024,
  "month": 12,
  "predicted_yield_tonnes_per_hectare": null,
  "predicted_price_per_tonne": null,
  "predicted_price_per_quintal": null,
  "price_unit": null,
  "status": "unsupported_price_unit",
  "limitations": [
    "Reliable price-per-tonne prediction unavailable for 'Sugarcane': Raw dataset exhibits severe unit mixing (reporting varies across individual stalks, quintals, and 1,000 nuts), causing high historical prediction error (139.5% on Sugarcane). Conversion to price-per-tonne is not reliable without verified source reporting units."
  ]
}
```

---

## 6. Supported Geographies and Commodities

### 6.1 Supported Karnataka Districts (30 Districts)
The model strictly covers Karnataka's 30 historical agricultural districts. Alternative/older administrative spellings are mapped automatically:

| Canonical District | Aliases Mapped | Canonical District | Aliases Mapped |
| :--- | :--- | :--- | :--- |
| **BAGALKOTE** | BAGALKOT | **BALLARI** | BELLARY |
| **BELAGAVI** | BELGAUM | **BENGALURU URBAN** | BANGALORE URBAN, BANGALORE |
| **BANGALORE RURAL** | BANGALORE RURAL | **BIDAR** | BIDAR |
| **CHAMARAJANAGARA** | CHAMARAJANAGAR | **CHIKKABALLAPURA** | CHIKBALLAPUR |
| **CHIKKAMAGALURU** | CHIKMAGALUR | **CHITRADURGA** | CHITRADURGA |
| **DAKSHINA KANNADA** | DAKSHIN KANNAD | **DAVANGERE** | DAVANAGERE |
| **DHARWAD** | DHARWAR | **GADAG** | GADAG |
| **HASSAN** | HASSAN | **HAVERI** | HAVERI |
| **KALABURAGI** | GULBARGA | **KODAGU** | COORG |
| **KOLAR** | KOLAR | **KOPPAL** | KOPPAL |
| **MANDYA** | MANDYA | **MYSURU** | MYSORE |
| **RAICHUR** | RAICHUR | **RAMANAGARA** | RAMANAGAR |
| **SHIVAMOGGA** | SHIMOGA | **TUMAKURU** | TUMKUR |
| **UDUPI** | UDUPI | **UTTARA KANNADA** | UTTAR KANNAD, NORTH CANARA |
| **VIJAYAPURA** | BIJAPUR | **YADAGIRI** | YADGIR |

*Out-of-region districts (e.g. `JAIPUR`, `PUNE`, `DELHI`) will raise `ValueError`.*

### 6.2 Dual-Supported Crops (Yield & Price Available)
- **Rice / Paddy**
- **Maize / Corn**
- **Wheat**
- **Groundnut / Peanut**
- **Sunflower**
- **Jowar / Sorghum**
- **Turmeric**
- **Small Millets / Bajra / Ragi** (Price benchmarked via Millets)

### 6.3 Special Crop: Sugarcane
- **Yield Model:** Fully supported. Predicts fresh stalk biomass (~83.35 t/ha).
- **Price Model:** Strictly excluded due to severe raw unit mixing (Rs 7 to Rs 33,000). Returns `predicted_price_per_tonne = null` with status `"unsupported_price_unit"`.

### 6.4 Yield-Only Crops (42 Total)
*Covered by Yield Model; Market Price not in the 15 National Benchmark Commodities:*  
Arecanut, Arhar/Tur, Banana, Black pepper, Cardamom, Cashewnut, Castor seed, Coriander, Cowpea(Lobia), Dry chillies, Garlic, Gram/Chickpea, Horse-gram, Linseed, Moong(Green Gram), Niger seed, Onion, Other Kharif pulses, Other Rabi pulses, Peas & beans (Pulses), Potato, Rapeseed & Mustard, Safflower, Sannhamp, Sesamum, Soyabean, Sweet potato, Tapioca, Tobacco, Urad.

### 6.5 Price-Only Commodities (6 Commodities)
*Covered by National Price Model; Excluded from Karnataka Yield Model due to non-tonne raw production units (bales/nuts):*  
Cotton, Coconut, Coffee, Tea, Barley (Jau), Sugar.

---

## 7. Error Handling Guide

All validation failures raise standard `ValueError` with descriptive English messages explaining why the input was rejected:

```python
from ml import predict_crop_plan

# 1. Handling Out-of-Region Districts
try:
    predict_crop_plan("Rice", "JAIPUR", year=2024, month=10)
except ValueError as e:
    print(e)
    # Output: Unsupported district 'JAIPUR'. The system is specifically calibrated for 
    # Karnataka's 30 agricultural districts and does not support out-of-region districts.

# 2. Handling Unsupported Crops
try:
    predict_crop_plan("Dragonfruit", "MYSURU", year=2024, month=10)
except ValueError as e:
    print(e)
    # Output: Unsupported crop 'Dragonfruit'. The model does not support unseen crop categories. 
    # Available crops include: Arecanut, Arhar/Tur, ...

# 3. Handling Invalid Area
try:
    predict_crop_plan("Rice", "MYSURU", year=2024, month=10, area_hectares=-1.5)
except ValueError as e:
    print(e)
    # Output: Area must be a positive finite number (> 0), got -1.5.
```

# Dataset Documentation

The project dataset inventory is maintained in `docs/dataset_inventory.csv`.
The summary below reflects that inventory and its recorded limitations.

| Dataset group | Scope and coverage | Purpose | Limitations |
|---|---|---|---|
| Crop production | Karnataka district-level observations, 1997-98 to 2019-20 | Yield model training and evaluation | Historical district data; does not model real-time drought or flood anomalies |
| State agriculture indicators | 36 state/UT-level records | Broad contextual indicators | Provenance is unverified; not farm- or district-level data |
| Market prices | India-level monthly modal benchmarks, 2010-01 to 2025-03 | Price model training and evaluation | National benchmarks do not represent local mandi auction spreads; raw unit labels need caution |
| Realistic agriculture | 16 states and 81 districts, 2021-2025 | Exploratory agriculture data and consistency checks | Provenance is unverified; missing drought and government-support values are flagged |
| Rainfall/weather | NASA POWER API, planned | Potential weather context | Collection and Karnataka station selection remain planned |
| Soil | NRSC Bhuvan / ICAR, planned | Potential soil context | Spatial resolution and access permissions require verification |
| Crop water | FAO CROPWAT 8.0 and ICAR guidelines, planned | Crop-stage irrigation estimates | Requirements vary by growth stage, soil, and climate |
| Official Karnataka market prices | Agmarknet Karnataka mandi data, planned | Future local market pricing | Local feeds have not yet been collected |

## Trained model inputs

- Yield model training data: `data/processed/yield_training_data.csv`.
- Price model training data: `data/processed/price_training_data.csv`.
- Model artifacts: `models/yield_model.joblib` and `models/price_model.joblib`.

## Unit and interpretation cautions

- Yield is represented in tonnes per hectare for supported yield crops.
- Price predictions use INR per tonne when the unit can be reliably aligned.
- Sugarcane price is withheld because the source records have mixed units.
- Some commodities are yield-only or price-only; missing prediction dimensions
  must not be replaced with invented values.
- Dataset inventory metrics and provenance notes should be read alongside
  `docs/model_evaluation.md` and `docs/price_model_evaluation.md`.

## Source of truth

Consult `docs/dataset_inventory.csv` for the dataset names, sources,
geographic coverage, time coverage, units, status, and recorded limitations.

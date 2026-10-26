"""
Agronomic reference data for Indian crops.

Source: ICAR (Indian Council of Agricultural Research) crop production guides,
MSP circulars (2023–24), and APMC wholesale market data.

All values are population-level estimates appropriate for smallholder farms
in India.  They are NOT live model predictions — they are reference benchmarks
used for planning feasibility checks.

Units:
  water_req_mm          — Total seasonal water requirement (rainfall + irrigation) in mm
  yield_t_per_acre      — Expected harvested yield in metric tonnes per acre
  price_inr_per_tonne   — Indicative wholesale / MSP market price in INR per tonne
  cost_inr_per_acre     — Estimated cultivation cost in INR per acre (seeds, labour,
                          fertiliser, pesticide, harvesting — excludes land rent)

Conversion reminder (used in crop_selector.py):
  1 mm water depth × 1 acre area = 4.04686 m³ volumetric water
"""

from typing import List, Dict, Any

# ---------------------------------------------------------------------------
# Water-depth → volumetric conversion constant
# ---------------------------------------------------------------------------
MM_PER_ACRE_TO_M3: float = 4.04686  # 1 mm × 1 acre = 4.04686 m³


# ---------------------------------------------------------------------------
# Crop reference database
# ---------------------------------------------------------------------------
CROP_DB: List[Dict[str, Any]] = [
    # ── Kharif (June – November) ──────────────────────────────────────────
    {
        "name": "Rice (Paddy)",
        "seasons": ["Kharif"],
        "soils": ["Loamy", "Clay", "Silty"],
        "water_req_mm": 1150,
        "yield_t_per_acre": 2.0,
        "price_inr_per_tonne": 21_000,
        "cost_inr_per_acre": 22_000,
        "duration_days": "120–150",
        "notes": "High water demand; best suited for assured irrigation.",
    },
    {
        "name": "Maize (Corn)",
        "seasons": ["Kharif", "Rabi"],
        "soils": ["Loamy", "Sandy", "Silty"],
        "water_req_mm": 520,
        "yield_t_per_acre": 2.0,
        "price_inr_per_tonne": 20_000,
        "cost_inr_per_acre": 12_000,
        "duration_days": "90–120",
        "notes": "Versatile dual-season crop; moderate water demand.",
    },
    {
        "name": "Soybean",
        "seasons": ["Kharif"],
        "soils": ["Loamy", "Clay"],
        "water_req_mm": 500,
        "yield_t_per_acre": 0.8,
        "price_inr_per_tonne": 43_000,
        "cost_inr_per_acre": 10_000,
        "duration_days": "90–110",
        "notes": "Nitrogen-fixing legume; valuable protein crop.",
    },
    {
        "name": "Cotton",
        "seasons": ["Kharif"],
        "soils": ["Loamy", "Clay"],
        "water_req_mm": 700,
        "yield_t_per_acre": 0.4,
        "price_inr_per_tonne": 65_000,
        "cost_inr_per_acre": 18_000,
        "duration_days": "150–180",
        "notes": "Cash crop; high revenue per tonne but high input cost.",
    },
    {
        "name": "Pearl Millet (Bajra)",
        "seasons": ["Kharif", "Summer"],
        "soils": ["Sandy", "Loamy"],
        "water_req_mm": 280,
        "yield_t_per_acre": 0.9,
        "price_inr_per_tonne": 23_500,
        "cost_inr_per_acre": 7_000,
        "duration_days": "75–100",
        "notes": "Drought-resilient; lowest irrigation requirement.",
    },
    {
        "name": "Groundnut (Peanut)",
        "seasons": ["Kharif", "Rabi"],
        "soils": ["Sandy", "Loamy"],
        "water_req_mm": 500,
        "yield_t_per_acre": 0.8,
        "price_inr_per_tonne": 55_000,
        "cost_inr_per_acre": 14_000,
        "duration_days": "100–130",
        "notes": "High-value oilseed; good market demand.",
    },
    {
        "name": "Sorghum (Jowar)",
        "seasons": ["Kharif", "Rabi"],
        "soils": ["Loamy", "Clay", "Sandy"],
        "water_req_mm": 350,
        "yield_t_per_acre": 1.2,
        "price_inr_per_tonne": 20_000,
        "cost_inr_per_acre": 7_000,
        "duration_days": "100–120",
        "notes": "Low input cost; drought tolerant.",
    },
    # ── Rabi (November – April) ───────────────────────────────────────────
    {
        "name": "Wheat",
        "seasons": ["Rabi"],
        "soils": ["Loamy", "Clay", "Silty"],
        "water_req_mm": 450,
        "yield_t_per_acre": 1.6,
        "price_inr_per_tonne": 22_000,
        "cost_inr_per_acre": 15_000,
        "duration_days": "110–140",
        "notes": "Staple cereal; strong MSP support.",
    },
    {
        "name": "Chickpea (Chana)",
        "seasons": ["Rabi"],
        "soils": ["Loamy", "Sandy", "Clay"],
        "water_req_mm": 300,
        "yield_t_per_acre": 0.6,
        "price_inr_per_tonne": 55_000,
        "cost_inr_per_acre": 9_000,
        "duration_days": "90–120",
        "notes": "Low irrigation pulse; high price realisation.",
    },
    {
        "name": "Mustard (Rapeseed)",
        "seasons": ["Rabi"],
        "soils": ["Loamy", "Sandy"],
        "water_req_mm": 280,
        "yield_t_per_acre": 0.5,
        "price_inr_per_tonne": 55_000,
        "cost_inr_per_acre": 8_000,
        "duration_days": "110–140",
        "notes": "Low water oilseed; good winter crop.",
    },
    {
        "name": "Sunflower",
        "seasons": ["Rabi", "Summer"],
        "soils": ["Loamy", "Clay"],
        "water_req_mm": 400,
        "yield_t_per_acre": 0.5,
        "price_inr_per_tonne": 60_000,
        "cost_inr_per_acre": 11_000,
        "duration_days": "85–110",
        "notes": "Dual-season oilseed; good intercropping potential.",
    },
    # ── Summer / Zaid (March – June) ─────────────────────────────────────
    {
        "name": "Mung Bean (Moong)",
        "seasons": ["Summer", "Kharif"],
        "soils": ["Loamy", "Sandy"],
        "water_req_mm": 350,
        "yield_t_per_acre": 0.35,
        "price_inr_per_tonne": 80_000,
        "cost_inr_per_acre": 8_000,
        "duration_days": "60–75",
        "notes": "Short-duration high-value pulse; quick soil rest.",
    },
    {
        "name": "Watermelon / Cucurbits",
        "seasons": ["Summer"],
        "soils": ["Sandy", "Loamy"],
        "water_req_mm": 450,
        "yield_t_per_acre": 8.0,
        "price_inr_per_tonne": 8_000,
        "cost_inr_per_acre": 12_000,
        "duration_days": "70–90",
        "notes": "High yield volume; perishable — requires nearby market access.",
    },
]

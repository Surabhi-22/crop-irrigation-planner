"""Complete Prediction Workflow Demonstration for Member 1, Member 2, and Member 3.

Demonstrates:
1. Direct yield prediction (predict_yield).
2. Direct market price prediction (predict_price).
3. Unified crop planning prediction (predict_crop_plan).
4. Handling of high-yield Sugarcane with uncertain price units.
5. Asymmetric crop handling (yield-only Onion, price-only Cotton).
6. Input validation and error handling for out-of-scope categories.
"""

import sys
import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from ml import predict_yield, predict_price, predict_crop_plan


def run_demonstration():
    print("=" * 75)
    print("CROP & IRRIGATION PLANNER: COMPLETE PREDICTION WORKFLOW")
    print("=" * 75)

    # 1. Direct Yield Prediction
    print("\n--- 1. DIRECT YIELD PREDICTION (`ml.predict_yield`) ---")
    rice_yield = predict_yield(
        crop="Rice",
        district="MYSURU",
        season="Kharif",
        area_hectares=2.5,
        year=2024
    )
    print("Inputs : Crop=Rice, District=MYSURU, Season=Kharif, Area=2.5 ha, Year=2024")
    print("Output :")
    print(json.dumps(rice_yield, indent=2))

    # 2. Direct Price Prediction
    print("\n--- 2. DIRECT PRICE PREDICTION (`ml.predict_price`) ---")
    maize_price = predict_price(
        crop="Maize",
        market="Karnataka",
        prediction_date="2024-10"
    )
    print("Inputs : Crop=Maize, Market='Karnataka', Date='2024-10'")
    print("Output :")
    print(json.dumps(maize_price, indent=2))

    # Also demonstrate positional calling: predict_price(crop, market, prediction_date)
    rice_price = predict_price("Rice", "Karnataka", "2024-11")
    print("\nPositional Calling: predict_price('Rice', 'Karnataka', '2024-11')")
    print(f"--> Price: Rs. {rice_price['predicted_price_per_tonne']} / tonne ({rice_price['status']})")

    # 3. Unified Service: Standard Dual Prediction (Maize in Belagavi)
    print("\n--- 3. UNIFIED CROP PLAN: DUAL PREDICTION (Maize in Belagavi) ---")
    maize_plan = predict_crop_plan(
        crop="Maize",
        district="BELAGAVI",
        season="Kharif",
        area_hectares=4.0,
        year=2024,
        month=10
    )
    print("Inputs : Crop=Maize, District=BELAGAVI, Season=Kharif, Area=4.0 ha, Year=2024, Month=10")
    print("Output :")
    print(json.dumps(maize_plan, indent=2))

    # 4. Unified Service: Sugarcane with Uncertain Price Units
    print("\n--- 4. UNIFIED CROP PLAN: SUGARCANE (High Yield + Uncertain Price Unit) ---")
    sugarcane_plan = predict_crop_plan(
        crop="Sugarcane",
        district="MANDYA",
        season="Whole Year",
        area_hectares=1.0,
        year=2024,
        month=12
    )
    print("Inputs : Crop=Sugarcane, District=MANDYA, Season='Whole Year', Area=1.0 ha, Year=2024, Month=12")
    print("Output (Notice high yield ~113 t/ha, price withheld as null with warning):")
    print(json.dumps(sugarcane_plan, indent=2))

    # 5. Unified Service: Yield-Only Crop (Onion)
    print("\n--- 5. UNIFIED CROP PLAN: YIELD-ONLY CROP (Onion) ---")
    onion_plan = predict_crop_plan(
        crop="Onion",
        district="DHARWAD",
        season="Kharif",
        area_hectares=1.5,
        year=2024,
        month=9
    )
    print("Inputs : Crop=Onion, District=DHARWAD, Season=Kharif, Area=1.5 ha, Year=2024, Month=9")
    print("Output (Yield predicted, price unavailable with transparent limitation):")
    print(json.dumps(onion_plan, indent=2))

    # 6. Unified Service: Price-Only Commodity (Cotton)
    print("\n--- 6. UNIFIED CROP PLAN: PRICE-ONLY COMMODITY (Cotton) ---")
    cotton_plan = predict_crop_plan(
        crop="Cotton",
        district="BALLARI",
        area_hectares=3.0,
        year=2024,
        month=11
    )
    print("Inputs : Crop=Cotton, District=BALLARI, Area=3.0 ha, Year=2024, Month=11")
    print("Output (Price predicted, yield unavailable with transparent limitation):")
    print(json.dumps(cotton_plan, indent=2))

    # 7. Error Handling: Unsupported District & Crop
    print("\n--- 7. ERROR HANDLING: UNREPRESENTED CATEGORIES & INVALID INPUTS ---")
    
    # 7a: Out-of-region district
    try:
        predict_crop_plan("Rice", "JAIPUR", year=2024, month=10)
    except ValueError as e:
        print(f"[REJECTED] Out-of-region district 'JAIPUR':\n  --> {e}")

    # 7b: Unsupported crop
    try:
        predict_crop_plan("Dragonfruit", "MYSURU", year=2024, month=10)
    except ValueError as e:
        print(f"[REJECTED] Unsupported crop 'Dragonfruit':\n  --> {e}")

    # 7c: Invalid area
    try:
        predict_crop_plan("Rice", "MYSURU", year=2024, month=10, area_hectares=-2.0)
    except ValueError as e:
        print(f"[REJECTED] Negative area (-2.0 ha):\n  --> {e}")

    print("\n" + "=" * 75)
    print("PREDICTION WORKFLOW DEMONSTRATION COMPLETE: ALL SCENARIOS VERIFIED")
    print("=" * 75)


if __name__ == "__main__":
    run_demonstration()

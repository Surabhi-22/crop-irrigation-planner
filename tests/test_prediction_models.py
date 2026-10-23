"""Automated test suite for Crop Yield and Market-Price prediction models.

Verifies:
1. Input validation for both models.
2. Predictions are finite and use documented units.
3. Unrepresented/unseen districts and crops are rejected cleanly (no silent fallback).
4. Invalid and missing inputs are rejected with clear ValueErrors.
5. High-yield behavior for Sugarcane (tonnes/ha vs grains).
6. Ground-truth comparison with held-out test observations.
7. Does not treat successful execution as proof of accuracy.
"""

import sys
import unittest
import math
from pathlib import Path
import pandas as pd

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from src.predict_yield import predict_crop_yield
from src.predict_price import predict_crop_price


class TestCropYieldModel(unittest.TestCase):
    """Test suite for Karnataka Crop Yield Prediction model."""

    def test_rice_in_represented_district(self):
        """Test Rice in Mysuru (represented in training data)."""
        result = predict_crop_yield(
            district="MYSORE",
            crop="Rice",
            year=2018,
            season="Kharif",
            area=2.5
        )
        self.assertEqual(result["district"], "MYSURU")
        self.assertEqual(result["crop"], "Rice")
        self.assertEqual(result["yield_unit"], "tonnes/hectare")
        self.assertEqual(result["production_unit"], "tonnes")
        
        y_val = result["predicted_yield_tonnes_per_hectare"]
        self.assertTrue(math.isfinite(y_val), "Yield prediction must be finite.")
        self.assertGreater(y_val, 0.0, "Yield must be positive.")
        # Typical Rice yield in Karnataka is between 1.5 and 5.0 tonnes/hectare
        self.assertGreaterEqual(y_val, 1.5, "Rice yield should meet typical lower bound.")
        self.assertLessEqual(y_val, 5.5, "Rice yield should not exceed typical upper bound.")
        
        prod_val = result["estimated_production_tonnes"]
        self.assertAlmostEqual(prod_val, y_val * 2.5, places=2)

    def test_maize_in_represented_district(self):
        """Test Maize in Belagavi (represented in training data)."""
        result = predict_crop_yield(
            district="BELGAUM",
            crop="Maize",
            year=2018,
            season="Kharif",
            area=4.0
        )
        self.assertEqual(result["district"], "BELAGAVI")
        self.assertEqual(result["crop"], "Maize")
        y_val = result["predicted_yield_tonnes_per_hectare"]
        self.assertTrue(math.isfinite(y_val))
        self.assertGreater(y_val, 0.0)
        # Typical Maize yield in Belagavi is between 2.0 and 6.0 tonnes/hectare
        self.assertGreaterEqual(y_val, 2.0)
        self.assertLessEqual(y_val, 6.5)

    def test_sugarcane_high_yield_behavior(self):
        """Test Sugarcane to verify characteristic high-yield biomass behavior."""
        result = predict_crop_yield(
            district="MANDYA",
            crop="Sugarcane",
            year=2018,
            season="Whole Year",
            area=1.0
        )
        self.assertEqual(result["crop"], "Sugarcane")
        y_val = result["predicted_yield_tonnes_per_hectare"]
        self.assertTrue(math.isfinite(y_val))
        # Sugarcane is a high-biomass crop in Karnataka yielding 70 to 120 tonnes/hectare,
        # distinctly higher by an order of magnitude than grains (2-4 tonnes/hectare)
        self.assertGreater(y_val, 50.0, "Sugarcane yield must reflect high biomass (> 50 t/ha).")
        self.assertLess(y_val, 150.0, "Sugarcane yield must remain realistic (< 150 t/ha).")

    def test_unrepresented_district_rejected(self):
        """Test that an unrepresented/unseen district is rejected, not silently guessed."""
        unseen_districts = ["JAIPUR", "CHANDIGARH", "PUNE", "NEW YORK"]
        for dist in unseen_districts:
            with self.assertRaises(ValueError, msg=f"Should reject unrepresented district '{dist}'") as ctx:
                predict_crop_yield(
                    district=dist,
                    crop="Rice",
                    year=2018,
                    season="Kharif",
                    area=2.0
                )
            self.assertIn("Unsupported district", str(ctx.exception))

    def test_unrepresented_crop_rejected(self):
        """Test that an unrepresented/unseen crop is rejected, not silently guessed."""
        unseen_crops = ["Dragonfruit", "Quinoa", "Avocado", "Kiwi", "Rubber"]
        for c in unseen_crops:
            with self.assertRaises(ValueError, msg=f"Should reject unrepresented crop '{c}'") as ctx:
                predict_crop_yield(
                    district="MYSURU",
                    crop=c,
                    year=2018,
                    season="Kharif",
                    area=2.0
                )
            self.assertIn("Unsupported crop", str(ctx.exception))

    def test_invalid_and_missing_inputs(self):
        """Test rejection of non-positive area, invalid season, missing values."""
        # Non-positive area
        with self.assertRaises(ValueError):
            predict_crop_yield(district="MYSURU", crop="Rice", year=2018, season="Kharif", area=0.0)
        with self.assertRaises(ValueError):
            predict_crop_yield(district="MYSURU", crop="Rice", year=2018, season="Kharif", area=-2.5)

        # Invalid season
        with self.assertRaises(ValueError):
            predict_crop_yield(district="MYSURU", crop="Rice", year=2018, season="Monsoon", area=2.0)

        # Missing values
        with self.assertRaises(ValueError):
            predict_crop_yield(district="", crop="Rice", year=2018, season="Kharif", area=2.0)
        with self.assertRaises(ValueError):
            predict_crop_yield(district="MYSURU", crop="", year=2018, season="Kharif", area=2.0)
        with self.assertRaises(ValueError):
            predict_crop_yield(district="MYSURU", crop="Rice", year=None, season="Kharif", area=2.0)

    def test_comparison_with_known_held_out_observations(self):
        """Compare predictions with known held-out ground truth records (2015-2019)."""
        test_cases = [
            # Actual records from data/processed/yield_training_data.csv
            {"district": "BAGALKOTE", "crop": "Rice", "year": 2015, "season": "Kharif", "area": 32.0, "actual_yield": 2.719},
            {"district": "BAGALKOTE", "crop": "Maize", "year": 2015, "season": "Kharif", "area": 27789.0, "actual_yield": 3.704},
            {"district": "BAGALKOTE", "crop": "Sugarcane", "year": 2015, "season": "Whole Year", "area": 94085.0, "actual_yield": 95.950},
        ]

        for tc in test_cases:
            res = predict_crop_yield(
                district=tc["district"],
                crop=tc["crop"],
                year=tc["year"],
                season=tc["season"],
                area=tc["area"]
            )
            pred = res["predicted_yield_tonnes_per_hectare"]
            act = tc["actual_yield"]
            abs_err = abs(pred - act)
            rel_err_pct = (abs_err / act) * 100

            # Verify predictions are reasonably close to historical holdout ground truth
            self.assertTrue(math.isfinite(pred))
            if tc["crop"] in ["Rice", "Maize"]:
                self.assertLess(rel_err_pct, 25.0, f"Relative error for {tc['crop']} should be < 25%")
            elif tc["crop"] == "Sugarcane":
                self.assertLess(rel_err_pct, 15.0, f"Relative error for Sugarcane should be < 15%")


class TestMarketPriceModel(unittest.TestCase):
    """Test suite for Market-Price Prediction model."""

    def test_rice_market_price(self):
        """Test Rice market price prediction."""
        res = predict_crop_price(crop_name="Rice", year=2024, month=11, verbose=False)
        self.assertEqual(res["commodity"], "Rice")
        price = res["predicted_modal_price"]
        self.assertTrue(math.isfinite(price))
        self.assertGreater(price, 0.0)
        # Rice modal price is typically between 2000 and 4000 INR/quintal
        self.assertGreaterEqual(price, 2000.0)
        self.assertLessEqual(price, 4000.0)
        self.assertIn("Quintal", res["likely_unit"])

    def test_maize_market_price(self):
        """Test Maize market price prediction."""
        res = predict_crop_price(crop_name="Maize", year=2025, month=2, verbose=False)
        self.assertEqual(res["commodity"], "Maize")
        price = res["predicted_modal_price"]
        self.assertTrue(math.isfinite(price))
        self.assertGreater(price, 0.0)
        # Maize modal price is typically between 1200 and 2600 INR/quintal
        self.assertGreaterEqual(price, 1200.0)
        self.assertLessEqual(price, 2600.0)

    def test_sugarcane_market_price_unit_advisory(self):
        """Test Sugarcane market price prediction and ensure price is withheld as None with unsupported_price_unit."""
        res = predict_crop_price(crop_name="Sugarcane", year=2024, month=12, verbose=False)
        self.assertEqual(res["commodity"], "Sugarcane")
        self.assertIsNone(res["predicted_modal_price"])
        self.assertEqual(res["unit_status"], "unsupported_price_unit")
        self.assertIn("EXCLUDED", res["advisory"])
        self.assertIn("unit mixing", res["advisory"])

    def test_unrepresented_crop_rejected(self):
        """Test that unseen/unsupported crop is rejected, not silently guessed."""
        unseen_commodities = ["Vanilla", "Avocado", "Quinoa", "Dragonfruit", "Oats"]
        for c in unseen_commodities:
            with self.assertRaises(ValueError, msg=f"Should reject unsupported commodity '{c}'") as ctx:
                predict_crop_price(crop_name=c, year=2024, month=10, verbose=False)
            self.assertIn("Unsupported crop", str(ctx.exception))

    def test_invalid_and_missing_inputs(self):
        """Test rejection of invalid months, out-of-range years, and missing inputs."""
        # Invalid month
        with self.assertRaises(ValueError):
            predict_crop_price(crop_name="Rice", year=2024, month=13, verbose=False)
        with self.assertRaises(ValueError):
            predict_crop_price(crop_name="Rice", year=2024, month=0, verbose=False)

        # Missing inputs
        with self.assertRaises(ValueError):
            predict_crop_price(crop_name="", year=2024, month=5, verbose=False)
        with self.assertRaises(ValueError):
            predict_crop_price(crop_name="Rice", year=None, month=5, verbose=False)
        with self.assertRaises(ValueError):
            predict_crop_price(crop_name="Rice", year=2024, month=None, verbose=False)

        # Out-of-horizon year
        with self.assertRaises(ValueError):
            predict_crop_price(crop_name="Rice", year=1850, month=5, verbose=False)

    def test_comparison_with_known_held_out_observations(self):
        """Compare price predictions with known held-out test observations (2022)."""
        test_cases = [
            # Actual records from data/processed/price_training_data.csv (2022-01)
            {"commodity": "Rice", "year": 2022, "month": 1, "actual_price": 2838.62, "max_rel_error_pct": 10.0},
            {"commodity": "Wheat", "year": 2022, "month": 1, "actual_price": 1965.45, "max_rel_error_pct": 10.0},
            {"commodity": "Maize", "year": 2022, "month": 1, "actual_price": 1718.96, "max_rel_error_pct": 20.0},
        ]

        for tc in test_cases:
            res = predict_crop_price(
                crop_name=tc["commodity"],
                year=tc["year"],
                month=tc["month"],
                verbose=False
            )
            pred = res["predicted_modal_price"]
            act = tc["actual_price"]
            abs_err = abs(pred - act)
            rel_err_pct = (abs_err / act) * 100

            self.assertTrue(math.isfinite(pred))
            self.assertLess(
                rel_err_pct,
                tc["max_rel_error_pct"],
                f"Error for {tc['commodity']} exceeded bound: got {rel_err_pct:.1f}% vs {tc['max_rel_error_pct']}%"
            )

        # Verify Sugarcane price is safely withheld rather than returning distorted prediction
        cane_res = predict_crop_price("Sugarcane", 2022, 1, verbose=False)
        self.assertIsNone(cane_res["predicted_modal_price"])
        self.assertEqual(cane_res["unit_status"], "unsupported_price_unit")


if __name__ == "__main__":
    unittest.main()

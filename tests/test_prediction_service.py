"""Unit tests for the shared prediction interface (src/prediction_service.py).

Tests:
1. Valid dual-supported inputs (Rice, Maize).
2. Sugarcane high-yield behavior with uncertain/mixed price unit handling (price = None).
3. Coconut mixed unit handling (price = None).
4. Yield-only crop handling (e.g. Onion: yield float, price = None).
5. Price-only commodity handling (e.g. Cotton: yield = None, price float).
6. Invalid area values (zero, negative, non-numeric).
7. Unsupported district rejection without silent fallback (e.g. JAIPUR).
8. Unsupported crop rejection without silent fallback (e.g. Dragonfruit).
9. Season / month harmonization and inference.
10. Strict verification of response dictionary schema.
"""

import sys
import unittest
import math
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from src.prediction_service import predict_crop_metrics, get_crop_prediction


class TestPredictionService(unittest.TestCase):
    """Test suite for shared prediction service."""

    def test_response_structure_keys(self):
        """Verify response contains all required documented fields."""
        required_fields = {
            "crop",
            "district",
            "year",
            "month",
            "predicted_yield_tonnes_per_hectare",
            "predicted_price_inr_per_quintal",
            "price_unit_status",
            "warnings",
        }
        res = predict_crop_metrics("Rice", "MYSURU", 2024, month=11, season="Kharif", area=2.0)
        self.assertTrue(required_fields.issubset(res.keys()), f"Missing fields: {required_fields - set(res.keys())}")
        self.assertIsInstance(res["warnings"], list)

    def test_valid_dual_supported_rice(self):
        """Test dual prediction for Rice in Mysuru."""
        res = predict_crop_metrics("Rice", "MYSORE", 2024, month=11, season="Kharif", area=2.5)
        self.assertEqual(res["crop"], "Rice")
        self.assertEqual(res["district"], "MYSURU")  # Canonicalized from MYSORE
        self.assertEqual(res["year"], 2024)
        self.assertEqual(res["month"], 11)

        # Yield checks
        y = res["predicted_yield_tonnes_per_hectare"]
        self.assertIsNotNone(y)
        self.assertTrue(math.isfinite(y))
        self.assertGreater(y, 1.5)
        self.assertLess(y, 5.0)

        # Price checks
        p = res["predicted_price_inr_per_quintal"]
        self.assertIsNotNone(p)
        self.assertTrue(math.isfinite(p))
        self.assertGreater(p, 2000.0)
        self.assertLess(p, 4000.0)
        self.assertEqual(res["price_unit_status"], "UNVERIFIED_STANDARD_ALIGNMENT")

    def test_valid_dual_supported_maize(self):
        """Test dual prediction for Maize in Belagavi."""
        res = predict_crop_metrics("Maize", "BELGAUM", 2024, month=10, season="Kharif", area=4.0)
        self.assertEqual(res["crop"], "Maize")
        self.assertEqual(res["district"], "BELAGAVI")

        y = res["predicted_yield_tonnes_per_hectare"]
        self.assertIsNotNone(y)
        self.assertTrue(math.isfinite(y))
        self.assertGreater(y, 2.0)
        self.assertLess(y, 6.0)

        p = res["predicted_price_inr_per_quintal"]
        self.assertIsNotNone(p)
        self.assertTrue(math.isfinite(p))
        self.assertGreater(p, 1200.0)
        self.assertLess(p, 2600.0)
        self.assertEqual(res["price_unit_status"], "UNVERIFIED_STANDARD_ALIGNMENT")

    def test_sugarcane_uncertain_price_units_and_high_yield(self):
        """Test Sugarcane: High-yield biomass verified, price withheld due to unit mixing."""
        res = predict_crop_metrics("Sugarcane", "MANDYA", 2024, month=12, area=1.0)
        self.assertEqual(res["crop"], "Sugarcane")
        self.assertEqual(res["district"], "MANDYA")

        # Yield must reflect high biomass (> 50 t/ha)
        y = res["predicted_yield_tonnes_per_hectare"]
        self.assertIsNotNone(y)
        self.assertGreater(y, 50.0)
        self.assertLess(y, 150.0)

        # Price MUST be None because unit mixing produces 139.5% error
        self.assertIsNone(res["predicted_price_inr_per_quintal"])
        self.assertEqual(res["price_unit_status"], "UNVERIFIED_MIXED_UNITS")

        # Must have warning explaining why price is withheld
        has_unit_warning = any("unit mixing" in w.lower() or "139.5%" in w for w in res["warnings"])
        self.assertTrue(has_unit_warning, "Expected warning about Sugarcane unit mixing.")

    def test_coconut_uncertain_price_units(self):
        """Test Coconut: Price withheld due to mixed nuts vs copra reporting units."""
        res = predict_crop_metrics("Coconut", "UDUPI", 2024, month=10, area=1.0)
        self.assertIsNone(res["predicted_price_inr_per_quintal"])
        self.assertEqual(res["price_unit_status"], "UNVERIFIED_MIXED_UNITS")

    def test_crop_in_yield_only_onion(self):
        """Test crop present in yield model but absent from market price data."""
        res = predict_crop_metrics("Onion", "DHARWAD", 2024, month=9, season="Kharif", area=1.5)
        self.assertIsNotNone(res["predicted_yield_tonnes_per_hectare"])
        self.assertIsNone(res["predicted_price_inr_per_quintal"])
        self.assertEqual(res["price_unit_status"], "UNAVAILABLE_NOT_IN_PRICE_DATA")
        has_warning = any("not covered" in w for w in res["warnings"])
        self.assertTrue(has_warning)

    def test_commodity_in_price_only_cotton(self):
        """Test commodity present in market price data but absent from yield model."""
        res = predict_crop_metrics("Cotton", "BALLARI", 2024, month=11, area=3.0)
        self.assertIsNone(res["predicted_yield_tonnes_per_hectare"])
        self.assertIsNotNone(res["predicted_price_inr_per_quintal"])
        self.assertEqual(res["price_unit_status"], "UNVERIFIED_STANDARD_ALIGNMENT")
        has_warning = any("yield prediction unavailable" in w.lower() for w in res["warnings"])
        self.assertTrue(has_warning)

    def test_invalid_area_rejected(self):
        """Test that invalid area inputs are rejected with ValueError."""
        with self.assertRaises(ValueError):
            predict_crop_metrics("Rice", "MYSURU", 2024, month=11, area=0.0)
        with self.assertRaises(ValueError):
            predict_crop_metrics("Rice", "MYSURU", 2024, month=11, area=-3.5)
        with self.assertRaises(ValueError):
            predict_crop_metrics("Rice", "MYSURU", 2024, month=11, area=float("nan"))

    def test_unsupported_district_rejected(self):
        """Test that out-of-region districts are rejected without silent fallback."""
        unseen_districts = ["JAIPUR", "CHANDIGARH", "PUNE", "DELHI"]
        for dist in unseen_districts:
            with self.assertRaises(ValueError) as ctx:
                predict_crop_metrics("Rice", dist, 2024, month=11, area=2.0)
            self.assertIn("Unsupported district", str(ctx.exception))

    def test_unsupported_crop_rejected(self):
        """Test that unseen crops are rejected without silent fallback."""
        unseen_crops = ["Dragonfruit", "Vanilla", "Avocado", "Kiwi"]
        for c in unseen_crops:
            with self.assertRaises(ValueError) as ctx:
                predict_crop_metrics(c, "MYSURU", 2024, month=11, area=2.0)
            self.assertIn("Unsupported crop", str(ctx.exception))

    def test_season_and_month_inference(self):
        """Test that missing season is inferred from month, and vice-versa."""
        # Month provided, season omitted -> Kharif inferred
        res1 = predict_crop_metrics("Rice", "MYSURU", 2024, month=8, area=2.0)
        self.assertEqual(res1["month"], 8)
        self.assertTrue(any("inferred" in w.lower() for w in res1["warnings"]))

        # Season provided, month omitted -> representative harvest month inferred
        res2 = predict_crop_metrics("Rice", "MYSURU", 2024, season="Kharif", area=2.0)
        self.assertEqual(res2["month"], 10)
        self.assertTrue(any("inferred" in w.lower() for w in res2["warnings"]))

        # Both omitted -> ValueError
        with self.assertRaises(ValueError):
            predict_crop_metrics("Rice", "MYSURU", 2024, month=None, season=None, area=2.0)

    def test_alias_equivalence(self):
        """Verify get_crop_prediction alias returns identical results."""
        res1 = predict_crop_metrics("Rice", "MYSURU", 2024, month=11, area=2.0)
        res2 = get_crop_prediction("Rice", "MYSURU", 2024, month=11, area=2.0)
        self.assertEqual(res1, res2)


if __name__ == "__main__":
    unittest.main()

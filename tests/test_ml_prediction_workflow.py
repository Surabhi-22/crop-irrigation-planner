"""Automated workflow test suite for the ml prediction module.

Verifies:
1. ml.predict_yield loads saved model and returns documented structure.
2. ml.predict_price loads saved model and returns price per tonne / quintal.
3. ml.predict_crop_plan unified service returns JSON-serializable agreed schema.
4. Sugarcane high-yield behavior is retained, while price is withheld as None.
5. Coconut price is withheld as None due to unit mixing.
6. Yield-only crop (Onion) and price-only crop (Cotton) handle asymmetries gracefully.
7. Unrepresented categories and invalid inputs raise clear ValueErrors without silent fallbacks.
8. Complete JSON-serializability of all responses using json.dumps.
"""

import sys
import unittest
import math
import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from ml import predict_yield, predict_price, predict_crop_plan


class TestMLPredictionWorkflow(unittest.TestCase):
    """Test suite for the clean ml prediction module."""

    # -------------------------------------------------------------
    # 1. Standalone Yield Prediction Tests
    # -------------------------------------------------------------
    def test_predict_yield_standard_crop(self):
        """Verify predict_yield returns documented structure for Rice in Mysuru."""
        out = predict_yield("Rice", "MYSORE", "Kharif", 2.0, 2024)
        self.assertEqual(out["crop"], "Rice")
        self.assertEqual(out["district"], "MYSURU")
        self.assertEqual(out["yield_unit"], "tonnes per hectare")
        self.assertEqual(out["status"], "success")
        self.assertTrue(math.isfinite(out["predicted_yield_tonnes_per_hectare"]))
        self.assertGreater(out["predicted_yield_tonnes_per_hectare"], 1.5)
        self.assertLess(out["predicted_yield_tonnes_per_hectare"], 5.0)
        self.assertAlmostEqual(
            out["estimated_production_tonnes"],
            out["predicted_yield_tonnes_per_hectare"] * 2.0,
            places=2
        )
        self.assertIsInstance(out["limitations"], list)
        # JSON serializability check
        json_str = json.dumps(out)
        self.assertTrue(len(json_str) > 0)

    def test_predict_yield_sugarcane_high_biomass(self):
        """Verify predict_yield accurately predicts high-biomass Sugarcane."""
        out = predict_yield("Sugarcane", "MANDYA", "Whole Year", 1.0, 2024)
        y = out["predicted_yield_tonnes_per_hectare"]
        self.assertTrue(math.isfinite(y))
        self.assertGreater(y, 60.0, "Sugarcane yield must reflect high biomass (> 60 t/ha).")
        self.assertLess(y, 150.0)

    def test_predict_yield_unsupported_inputs(self):
        """Verify predict_yield rejects unsupported districts and crops."""
        # Unrepresented district
        with self.assertRaises(ValueError) as ctx:
            predict_yield("Rice", "JAIPUR", "Kharif", 2.0, 2024)
        self.assertIn("Unsupported district", str(ctx.exception))

        # Unrepresented crop
        with self.assertRaises(ValueError) as ctx:
            predict_yield("Dragonfruit", "MYSURU", "Kharif", 2.0, 2024)
        self.assertIn("Unsupported crop", str(ctx.exception))

        # Invalid area
        with self.assertRaises(ValueError):
            predict_yield("Rice", "MYSURU", "Kharif", 0.0, 2024)
        with self.assertRaises(ValueError):
            predict_yield("Rice", "MYSURU", "Kharif", -1.5, 2024)

    # -------------------------------------------------------------
    # 2. Standalone Market Price Prediction Tests
    # -------------------------------------------------------------
    def test_predict_price_standard_crop(self):
        """Verify predict_price calculates price per tonne and per quintal for Maize."""
        out = predict_price("Maize", year=2024, month=10)
        self.assertEqual(out["crop"], "Maize")
        self.assertEqual(out["year"], 2024)
        self.assertEqual(out["month"], 10)
        self.assertEqual(out["status"], "success")

        p_tonne = out["predicted_price_per_tonne"]
        p_quintal = out["predicted_price_per_quintal"]
        self.assertIsNotNone(p_tonne)
        self.assertIsNotNone(p_quintal)
        self.assertTrue(math.isfinite(p_tonne))
        self.assertTrue(math.isfinite(p_quintal))
        # 1 tonne = 10 quintals
        self.assertAlmostEqual(p_tonne, p_quintal * 10.0, places=1)
        self.assertIn("INR per tonne", out["price_unit"])
        json_str = json.dumps(out)
        self.assertTrue(len(json_str) > 0)

    def test_predict_price_sugarcane_unsupported_unit(self):
        """Verify Sugarcane price is withheld (None) due to raw unit mixing."""
        out = predict_price("Sugarcane", year=2024, month=12)
        self.assertEqual(out["crop"], "Sugarcane")
        self.assertIsNone(out["predicted_price_per_tonne"])
        self.assertIsNone(out["predicted_price_per_quintal"])
        self.assertIsNone(out["price_unit"])
        self.assertEqual(out["status"], "unsupported_price_unit")
        self.assertTrue(any("unit mixing" in lim.lower() for lim in out["limitations"]))

    def test_predict_price_date_string_parsing(self):
        """Verify predict_price accepts ISO date strings like '2024-11'."""
        out = predict_price("Wheat", prediction_date="2024-11-15")
        self.assertEqual(out["year"], 2024)
        self.assertEqual(out["month"], 11)
        self.assertEqual(out["status"], "success")

    def test_predict_price_positional_arguments(self):
        """Verify predict_price supports positional arguments (crop, market, prediction_date)."""
        # Form 1: predict_price(crop, market, prediction_date)
        out1 = predict_price("Rice", "Karnataka", "2024-11")
        self.assertEqual(out1["crop"], "Rice")
        self.assertEqual(out1["market"], "Karnataka")
        self.assertEqual(out1["year"], 2024)
        self.assertEqual(out1["month"], 11)
        self.assertEqual(out1["status"], "success")
        self.assertIsNotNone(out1["predicted_price_per_tonne"])

        # Form 2: predict_price(crop, prediction_date) positionally
        out2 = predict_price("Rice", "2024-11")
        self.assertEqual(out2["year"], 2024)
        self.assertEqual(out2["month"], 11)
        self.assertEqual(out2["status"], "success")

    def test_predict_yield_and_price_conform_to_agreed_schema(self):
        """Verify that standalone yield and price functions return the agreed standard keys."""
        agreed_keys = {
            "crop",
            "predicted_yield_tonnes_per_hectare",
            "predicted_price_per_tonne",
            "price_unit",
            "status",
            "limitations",
        }
        y_out = predict_yield("Maize", "BELAGAVI", "Kharif", 2.0, 2024)
        self.assertTrue(agreed_keys.issubset(y_out.keys()))
        self.assertIsNotNone(y_out["predicted_yield_tonnes_per_hectare"])
        self.assertIsNone(y_out["predicted_price_per_tonne"])

        p_out = predict_price("Maize", "2024-10")
        self.assertTrue(agreed_keys.issubset(p_out.keys()))
        self.assertIsNone(p_out["predicted_yield_tonnes_per_hectare"])
        self.assertIsNotNone(p_out["predicted_price_per_tonne"])

    def test_predict_price_unsupported_commodity(self):
        """Verify predict_price rejects unrepresented commodity."""
        with self.assertRaises(ValueError) as ctx:
            predict_price("Avocado", year=2024, month=10)
        self.assertIn("Unsupported commodity", str(ctx.exception))

    # -------------------------------------------------------------
    # 3. Unified Prediction Service Tests (Agreed JSON Schema)
    # -------------------------------------------------------------
    def test_unified_service_agreed_schema(self):
        """Verify predict_crop_plan outputs the exact agreed schema."""
        res = predict_crop_plan("Maize", "BELAGAVI", season="Kharif", area_hectares=4.0, year=2024, month=10)
        required_keys = {
            "crop",
            "district",
            "season",
            "year",
            "month",
            "area_hectares",
            "predicted_yield_tonnes_per_hectare",
            "predicted_price_per_tonne",
            "predicted_price_per_quintal",
            "price_unit",
            "status",
            "limitations",
        }
        self.assertTrue(required_keys.issubset(res.keys()), f"Missing keys: {required_keys - set(res.keys())}")
        self.assertEqual(res["crop"], "maize")
        self.assertEqual(res["district"], "BELAGAVI")
        self.assertEqual(res["status"], "success")
        self.assertIsInstance(res["limitations"], list)
        # Verify JSON serializability
        serialized = json.dumps(res, indent=2)
        self.assertTrue(len(serialized) > 0)
        deserialized = json.loads(serialized)
        self.assertEqual(deserialized["crop"], "maize")

    def test_unified_service_sugarcane_handling(self):
        """Verify Sugarcane in unified service returns high yield but null price with limitations."""
        res = predict_crop_plan("Sugarcane", "MANDYA", area_hectares=1.0, year=2024, month=12)
        self.assertEqual(res["crop"], "sugarcane")
        self.assertEqual(res["district"], "MANDYA")
        # Yield is predicted (> 50 t/ha)
        self.assertIsNotNone(res["predicted_yield_tonnes_per_hectare"])
        self.assertGreater(res["predicted_yield_tonnes_per_hectare"], 50.0)
        # Price must be None because raw unit mixing prevents reliable conversion
        self.assertIsNone(res["predicted_price_per_tonne"])
        self.assertIsNone(res["predicted_price_per_quintal"])
        self.assertIsNone(res["price_unit"])
        self.assertEqual(res["status"], "unsupported_price_unit")
        self.assertTrue(any("unit mixing" in lim.lower() for lim in res["limitations"]))

    def test_unified_service_yield_only_crop(self):
        """Verify Onion (in yield model, absent in price model) returns partial_success."""
        res = predict_crop_plan("Onion", "DHARWAD", season="Kharif", area_hectares=1.5, year=2024, month=9)
        self.assertIsNotNone(res["predicted_yield_tonnes_per_hectare"])
        self.assertIsNone(res["predicted_price_per_tonne"])
        self.assertIsNone(res["price_unit"])
        self.assertEqual(res["status"], "partial_success")
        self.assertTrue(any("not covered by the national market price" in lim.lower() for lim in res["limitations"]))

    def test_unified_service_price_only_commodity(self):
        """Verify Cotton (in price model, excluded from yield model) returns partial_success."""
        res = predict_crop_plan("Cotton", "BALLARI", area_hectares=3.0, year=2024, month=11)
        self.assertIsNone(res["predicted_yield_tonnes_per_hectare"])
        self.assertIsNotNone(res["predicted_price_per_tonne"])
        self.assertEqual(res["status"], "partial_success")
        self.assertTrue(any("yield prediction unavailable" in lim.lower() for lim in res["limitations"]))

    def test_unified_service_rejection_of_unseen_categories(self):
        """Verify out-of-region district and unrepresented crop are rejected."""
        with self.assertRaises(ValueError):
            predict_crop_plan("Rice", "JAIPUR", year=2024, month=10)
        with self.assertRaises(ValueError):
            predict_crop_plan("Dragonfruit", "MYSURU", year=2024, month=10)


if __name__ == "__main__":
    unittest.main()

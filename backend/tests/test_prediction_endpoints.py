"""
Unit tests for Machine Learning Prediction API endpoints:
- POST /api/v1/predict/yield
- POST /api/v1/predict/price
- POST /api/v1/predict/plan
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_predict_yield_success():
    payload = {
        "crop": "Rice",
        "district": "MYSURU",
        "season": "Kharif",
        "area_hectares": 2.5,
        "year": 2024,
    }
    resp = client.post("/api/v1/predict/yield", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["crop"] == "Rice"
    assert data["district"] == "MYSURU"
    assert data["predicted_yield_tonnes_per_hectare"] is not None
    assert data["predicted_yield_tonnes_per_hectare"] > 0
    assert data["estimated_production_tonnes"] > 0
    assert data["status"] == "success"


def test_predict_yield_sugarcane_high_biomass():
    payload = {
        "crop": "Sugarcane",
        "district": "MANDYA",
        "season": "Whole Year",
        "area_hectares": 1.0,
        "year": 2024,
    }
    resp = client.post("/api/v1/predict/yield", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["predicted_yield_tonnes_per_hectare"] > 40.0


def test_predict_yield_invalid_district():
    payload = {
        "crop": "Rice",
        "district": "JAIPUR",
        "season": "Kharif",
        "area_hectares": 2.0,
        "year": 2024,
    }
    resp = client.post("/api/v1/predict/yield", json=payload)
    assert resp.status_code == 400
    assert "JAIPUR" in resp.json()["detail"]


def test_predict_price_success():
    payload = {
        "crop": "Maize",
        "year": 2024,
        "month": 10,
    }
    resp = client.post("/api/v1/predict/price", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["crop"] == "Maize"
    assert data["predicted_price_per_tonne"] is not None
    assert data["predicted_price_per_tonne"] > 1000
    assert data["status"] == "success"


def test_predict_price_sugarcane_unsupported_unit():
    payload = {
        "crop": "Sugarcane",
        "year": 2024,
        "month": 12,
    }
    resp = client.post("/api/v1/predict/price", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "unsupported_price_unit"
    assert data["predicted_price_per_tonne"] is None
    assert any("unit" in lim.lower() for lim in data["limitations"])


def test_predict_plan_unified():
    payload = {
        "crop": "Maize",
        "district": "BELAGAVI",
        "season": "Kharif",
        "area_hectares": 4.0,
        "year": 2024,
        "month": 10,
    }
    resp = client.post("/api/v1/predict/plan", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["crop"] == "maize"
    assert data["district"] == "BELAGAVI"
    assert data["predicted_yield_tonnes_per_hectare"] is not None
    assert data["predicted_price_per_tonne"] is not None
    assert data["status"] == "success"

VALID_PAYLOAD = {
    "area_acres": 5.0,
    "soil_type": "Loamy",
    "expected_rainfall_mm": 650.0,
    "available_water_m3": 3000.0,
    "location": "Bengaluru",
    "season": "Kharif",
    "budget_inr": 8500.0,
}


def test_validate_farm_input_success(client):
    """Test successful validation of standard valid farm parameters."""
    response = client.post("/api/v1/farm/validate", json=VALID_PAYLOAD)
    assert response.status_code == 200
    data = response.json()
    assert data["valid"] is True
    assert "Farm input parameters are valid" in data["message"]
    assert data["data"]["area_acres"] == 5.0
    assert data["data"]["soil_type"] == "Loamy"
    assert data["data"]["expected_rainfall_mm"] == 650.0
    assert data["data"]["available_water_m3"] == 3000.0
    assert data["data"]["location"] == "Bengaluru"
    assert data["data"]["season"] == "Kharif"
    assert data["data"]["budget_inr"] == 8500.0


def test_validate_farm_input_zero_boundaries(client):
    """Zero rainfall, zero water reserve, and zero budget are valid non-negative numbers."""
    payload = {
        **VALID_PAYLOAD,
        "expected_rainfall_mm": 0.0,
        "available_water_m3": 0.0,
        "budget_inr": 0.0,
    }
    response = client.post("/api/v1/farm/validate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["valid"] is True
    assert data["data"]["expected_rainfall_mm"] == 0.0
    assert data["data"]["available_water_m3"] == 0.0
    assert data["data"]["budget_inr"] == 0.0


def test_reject_negative_area(client):
    """Cultivation area cannot be negative."""
    payload = {**VALID_PAYLOAD, "area_acres": -2.5}
    response = client.post("/api/v1/farm/validate", json=payload)
    assert response.status_code == 422


def test_reject_zero_area(client):
    """Cultivation area must be strictly positive (> 0)."""
    payload = {**VALID_PAYLOAD, "area_acres": 0.0}
    response = client.post("/api/v1/farm/validate", json=payload)
    assert response.status_code == 422


def test_reject_negative_rainfall(client):
    """Precipitation cannot be negative."""
    payload = {**VALID_PAYLOAD, "expected_rainfall_mm": -10.0}
    response = client.post("/api/v1/farm/validate", json=payload)
    assert response.status_code == 422


def test_reject_negative_water(client):
    """Volumetric water reserve cannot be negative."""
    payload = {**VALID_PAYLOAD, "available_water_m3": -500.0}
    response = client.post("/api/v1/farm/validate", json=payload)
    assert response.status_code == 422


def test_reject_negative_budget(client):
    """Budget cannot be negative."""
    payload = {**VALID_PAYLOAD, "budget_inr": -100.0}
    response = client.post("/api/v1/farm/validate", json=payload)
    assert response.status_code == 422


def test_reject_missing_required_fields(client):
    """Omitting any required field must trigger 422 Unprocessable Entity."""
    required_fields = [
        "area_acres",
        "soil_type",
        "expected_rainfall_mm",
        "available_water_m3",
        "location",
        "season",
        "budget_inr",
    ]
    for field in required_fields:
        payload = {k: v for k, v in VALID_PAYLOAD.items() if k != field}
        response = client.post("/api/v1/farm/validate", json=payload)
        assert response.status_code == 422, f"Failed to reject payload missing '{field}'"


def test_reject_empty_string_fields(client):
    """Whitespace-only string fields must be rejected."""
    for str_field in ["location", "soil_type", "season"]:
        payload = {**VALID_PAYLOAD, str_field: "   "}
        response = client.post("/api/v1/farm/validate", json=payload)
        assert response.status_code == 422, f"Failed to reject empty whitespace in '{str_field}'"


def test_reject_invalid_data_types(client):
    """Non-numeric strings for numeric fields must be rejected."""
    payload = {**VALID_PAYLOAD, "area_acres": "five-acres"}
    response = client.post("/api/v1/farm/validate", json=payload)
    assert response.status_code == 422


def test_whitespace_trimming_on_valid_strings(client):
    """String fields with surrounding whitespace must be trimmed and normalized."""
    payload = {
        **VALID_PAYLOAD,
        "location": "   Mysuru Rural   ",
        "soil_type": "   Clay   ",
        "season": "   Rabi   ",
    }
    response = client.post("/api/v1/farm/validate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["valid"] is True
    assert data["data"]["location"] == "Mysuru Rural"
    assert data["data"]["soil_type"] == "Clay"
    assert data["data"]["season"] == "Rabi"


def test_reject_excessive_string_length(client):
    """Strings exceeding schema max_length must be rejected."""
    # Location max_length is 100
    payload = {**VALID_PAYLOAD, "location": "A" * 101}
    response = client.post("/api/v1/farm/validate", json=payload)
    assert response.status_code == 422

    # Soil type max_length is 50
    payload = {**VALID_PAYLOAD, "soil_type": "S" * 51}
    response = client.post("/api/v1/farm/validate", json=payload)
    assert response.status_code == 422


def test_response_schema_contract(client):
    """Response must strictly adhere to FarmValidationResponse schema contract."""
    response = client.post("/api/v1/farm/validate", json=VALID_PAYLOAD)
    assert response.status_code == 200
    json_data = response.json()

    # Verify top-level keys
    assert set(json_data.keys()) == {"valid", "message", "data"}
    assert isinstance(json_data["valid"], bool)
    assert isinstance(json_data["message"], str)
    assert isinstance(json_data["data"], dict)

    # Verify echoed data fields with physical units
    expected_data_keys = {
        "area_acres",
        "soil_type",
        "expected_rainfall_mm",
        "available_water_m3",
        "location",
        "season",
        "budget_inr",
    }
    assert set(json_data["data"].keys()) == expected_data_keys


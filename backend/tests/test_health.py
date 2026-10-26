def test_root_endpoint(client):
    """Test the root endpoint metadata."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "Crop & Irrigation Planner API"
    assert data["team"] == "Anvaya"
    assert data["status"] == "online"
    assert "version" in data
    assert "docs" in data


def test_root_health_check(client):
    """Test the root-level /health endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["app_name"] == "Crop & Irrigation Planner API"
    assert "timestamp" in data


def test_api_v1_health_check(client):
    """Test the /api/v1/health endpoint."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["app_name"] == "Crop & Irrigation Planner API"
    assert "timestamp" in data


def test_cors_headers_configured(client):
    """Test that allowed CORS origins receive proper access control headers."""
    for origin in [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ]:
        # Preflight OPTIONS request on /api/v1/health
        response = client.options(
            "/api/v1/health",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "GET",
            },
        )
        assert response.headers.get("access-control-allow-origin") == origin
        assert response.headers.get("access-control-allow-credentials") == "true"


def test_cors_headers_for_farm_validate_from_port_5174(client):
    """Test that preflight and POST requests from http://localhost:5174 to /api/v1/farm/validate succeed with CORS headers."""
    origin = "http://localhost:5174"

    # Preflight OPTIONS check
    options_resp = client.options(
        "/api/v1/farm/validate",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert options_resp.status_code == 200
    assert options_resp.headers.get("access-control-allow-origin") == origin
    assert options_resp.headers.get("access-control-allow-credentials") == "true"

    # Actual POST request with Origin header
    post_resp = client.post(
        "/api/v1/farm/validate",
        json={
            "area_acres": 5.0,
            "soil_type": "Loamy",
            "expected_rainfall_mm": 650.0,
            "available_water_m3": 3000.0,
            "location": "Bengaluru",
            "season": "Kharif",
            "budget_inr": 8500.0,
        },
        headers={"Origin": origin},
    )
    assert post_resp.status_code == 200
    assert post_resp.headers.get("access-control-allow-origin") == origin


def test_cors_rejects_unauthorized_origin(client):
    """Test that an untrusted origin does not receive access-control-allow-origin."""
    response = client.options(
        "/api/v1/farm/validate",
        headers={
            "Origin": "http://malicious-site.com",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert response.headers.get("access-control-allow-origin") is None


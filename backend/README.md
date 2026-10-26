# Crop & Irrigation Planner — FastAPI Backend Foundation

**Team:** Anvaya  
**Role:** Full-Stack & AI Integration Lead  
**Technology:** Python 3.10+, FastAPI, Uvicorn, Pydantic v2, pytest

---

## 1. Project Structure

```text
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                     # FastAPI application initialization & middleware
│   ├── core/
│   │   ├── __init__.py
│   │   └── config.py               # Pydantic BaseSettings, CORS, API prefixes
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── health.py               # HealthResponse schema
│   │   └── farm.py                 # FarmInput & FarmValidationResponse schemas
│   └── api/
│       ├── __init__.py
│       └── v1/
│           ├── __init__.py
│           ├── router.py           # API v1 router aggregator
│           └── endpoints/
│               ├── __init__.py
│               ├── health.py       # GET /api/v1/health
│               └── farm.py         # POST /api/v1/farm/validate
├── tests/
│   ├── __init__.py
│   ├── conftest.py                 # TestClient fixture
│   ├── test_health.py              # Health check & CORS tests
│   └── test_farm_validation.py     # Farm input boundary & rejection tests
├── requirements.txt                # Production & test dependencies
├── .env.example                    # Environment variable template
└── README.md                       # Setup and operational instructions
```

---

## 2. API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **GET** | `/` | Root service metadata, version, and documentation links. |
| **GET** | `/health` | Top-level operational health status. |
| **GET** | `/api/v1/health` | API version 1 health check. |
| **POST** | `/api/v1/farm/validate` | Validates farm input parameters and echoes normalized data. |
| **GET** | `/docs` | Interactive Swagger / OpenAPI documentation UI. |
| **GET** | `/redoc` | ReDoc API documentation UI. |

### FarmInput Schema (`POST /api/v1/farm/validate`)

```json
{
  "area_acres": 5.0,
  "soil_type": "Loamy",
  "expected_rainfall_mm": 650.0,
  "available_water_m3": 3000.0,
  "location": "Bengaluru",
  "season": "Kharif",
  "budget_inr": 8500.0
}
```

* **`area_acres`**: Strictly positive float (`> 0`). Rejects zero and negative numbers.
* **`soil_type`**: Non-empty trimmed string (e.g. `Loamy`, `Clay`, `Sandy`, `Silty`).
* **`expected_rainfall_mm`**: Non-negative float (`>= 0`).
* **`available_water_m3`**: Non-negative float (`>= 0`).
* **`location`**: Non-empty trimmed string.
* **`season`**: Non-empty trimmed string (e.g. `Kharif`, `Rabi`, `Summer`).
* **`budget_inr`**: Non-negative float (`>= 0`).

---

## 3. Windows PowerShell Setup Instructions

Follow these exact steps in PowerShell from the repository root:

### Step 1: Navigate to the Backend Folder
```powershell
cd c:\Users\SOURABH\Hackathons\crop-irrigation-planner\backend
```

### Step 2: Create a Python Virtual Environment
*(Never install dependencies into your global Python environment)*
```powershell
python -m venv .venv
```

### Step 3: Activate the Virtual Environment
```powershell
# If script execution is blocked on your system, enable it for this terminal session:
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

# Activate:
.\.venv\Scripts\Activate.ps1
```
*(Your terminal prompt will now show `(.venv)`)*

### Step 4: Install Dependencies
```powershell
pip install --upgrade pip
pip install -r requirements.txt
```

### Step 5: Run Automated Tests
```powershell
pytest -v
```

### Step 6: Start the Development Server
```powershell
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Step 7: Verify in Browser
* **Root API:** [http://127.0.0.1:8000/](http://127.0.0.1:8000/)
* **Health Check:** [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)
* **API v1 Health:** [http://127.0.0.1:8000/api/v1/health](http://127.0.0.1:8000/api/v1/health)
* **Interactive Swagger Docs:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

---

## 4. Teammate Integration Blueprint

* **Member 1 (AI/ML Crop Models):** Add model artifacts under `backend/app/models/` and export prediction endpoints under `backend/app/api/v1/endpoints/recommendation.py`.
* **Member 2 (Water & Crop Allocation Optimization):** Place linear programming / constraint solvers under `backend/app/services/optimizer/` and expose via `backend/app/api/v1/endpoints/optimization.py`.
* The `FarmInput` schema serves as the single source of truth for both downstream modules.

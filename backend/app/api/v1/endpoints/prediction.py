"""
Prediction endpoints — ML Yield & Price Prediction

Endpoints:
  POST /api/v1/predict/yield      - Standalone crop yield prediction
  POST /api/v1/predict/price      - Standalone market price prediction
  POST /api/v1/predict/plan       - Unified crop planning prediction (yield + price)
  POST /api/v1/predict/crop-plan  - Alias for unified crop planning prediction
"""

import logging
from fastapi import APIRouter, HTTPException

from app.schemas.prediction import (
    YieldPredictionRequest,
    YieldPredictionResponse,
    PricePredictionRequest,
    PricePredictionResponse,
    CropPlanPredictionRequest,
    CropPlanPredictionResponse,
)
from app.ml import predict_yield, predict_price, predict_crop_plan

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post(
    "/predict/yield",
    response_model=YieldPredictionResponse,
    summary="Predict Crop Yield",
    description="Estimates crop yield (tonnes/ha) and total production for 42 Karnataka crops.",
    tags=["Prediction"],
)
def get_yield_prediction(req: YieldPredictionRequest) -> YieldPredictionResponse:
    try:
        res = predict_yield(
            crop=req.crop,
            district=req.district,
            season=req.season,
            area_hectares=req.area_hectares,
            year=req.year,
        )
        return YieldPredictionResponse(**res)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.exception("Unexpected error in yield prediction: %s", exc)
        raise HTTPException(status_code=500, detail="Yield prediction service error.")


@router.post(
    "/predict/price",
    response_model=PricePredictionResponse,
    summary="Predict Market Price",
    description="Forecasts wholesale commodity benchmark prices in Karnataka.",
    tags=["Prediction"],
)
def get_price_prediction(req: PricePredictionRequest) -> PricePredictionResponse:
    try:
        res = predict_price(
            crop=req.crop,
            market=req.market,
            prediction_date=req.prediction_date,
            year=req.year,
            month=req.month,
        )
        return PricePredictionResponse(**res)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.exception("Unexpected error in price prediction: %s", exc)
        raise HTTPException(status_code=500, detail="Price prediction service error.")


@router.post(
    "/predict/plan",
    response_model=CropPlanPredictionResponse,
    summary="Unified Crop Plan Prediction",
    description="Combines yield and price prediction into unified agronomic and economic forecast.",
    tags=["Prediction"],
)
@router.post(
    "/predict/crop-plan",
    response_model=CropPlanPredictionResponse,
    include_in_schema=False,
)
def get_crop_plan_prediction(req: CropPlanPredictionRequest) -> CropPlanPredictionResponse:
    try:
        res = predict_crop_plan(
            crop=req.crop,
            district=req.district,
            season=req.season,
            area_hectares=req.area_hectares,
            year=req.year,
            month=req.month,
            prediction_date=req.prediction_date,
            market=req.market,
        )
        return CropPlanPredictionResponse(**res)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.exception("Unexpected error in unified crop plan prediction: %s", exc)
        raise HTTPException(status_code=500, detail="Crop plan prediction service error.")

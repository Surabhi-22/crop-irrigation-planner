"""Machine Learning and Prediction package for Crop & Irrigation Planner.

Exposes:
- predict_yield (from ml.yield_prediction)
- predict_price (from ml.price_prediction)
- predict_crop_plan, predict_crop_metrics, get_crop_prediction (from ml.prediction_service)
"""

from ml.yield_prediction import predict_yield
from ml.price_prediction import predict_price
from ml.prediction_service import (
    predict_crop_plan,
    predict_crop_metrics,
    get_crop_prediction,
)

__all__ = [
    "predict_yield",
    "predict_price",
    "predict_crop_plan",
    "predict_crop_metrics",
    "get_crop_prediction",
]

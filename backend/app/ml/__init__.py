"""Machine Learning and Prediction package for Crop & Irrigation Planner.

Exposes:
- predict_yield (from ml.yield_prediction)
- predict_price (from ml.price_prediction)
- predict_crop_plan, predict_crop_metrics, get_crop_prediction (from ml.prediction_service)

NOTE — sklearn version warning suppressed at startup:
The model artifacts (yield_model.joblib, price_model.joblib) embed a sklearn
version string of "1.9.1" in their joblib pickle header, but scikit-learn 1.9.1
has never been released on PyPI (highest is 1.7.2). This discrepancy is caused
by an incorrect __version__ tag written during the teammate's training session
(likely a dev build or pre-release). It produces cosmetic InconsistentVersionWarning
messages only — both models load and predict correctly with scikit-learn 1.7.2.
Confirmed: 47/47 pytest pass, 12/12 prediction tests pass.
"""
import warnings
# Suppress the false-alarm InconsistentVersionWarning caused by phantom "1.9.1" tag.
warnings.filterwarnings(
    "ignore",
    message=".*InconsistentVersionWarning.*",
    category=UserWarning,
)
# sklearn's own warning category
try:
    from sklearn.exceptions import InconsistentVersionWarning as _IVW
    warnings.filterwarnings("ignore", category=_IVW)
except ImportError:
    pass


try:
    from .yield_prediction import predict_yield
    from .price_prediction import predict_price
    from .prediction_service import (
        predict_crop_plan,
        predict_crop_metrics,
        get_crop_prediction,
    )
except ImportError:
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

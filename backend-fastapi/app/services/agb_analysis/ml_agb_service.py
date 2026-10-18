import logging
from typing import Any, Dict, List

# pyrefly: ignore [missing-import]
import joblib
import numpy as np
import pandas as pd

from .agb_feature_contract import (
    valid_feature_mask,
)
from .model_registry import get_active_model_config

logger = logging.getLogger(__name__)


class MlAgbService:
    _model = None
    _model_version = None
    _model_path = None

    @classmethod
    def get_model(cls):
        """
        Memuat model LightGBM Regressor sebagai singleton.
        """
        config = get_active_model_config()
        if (
            cls._model is None
            or cls._model_version != config.version
            or cls._model_path != config.model_path
        ):
            if not config.model_path.is_file():
                raise FileNotFoundError(f"Model LightGBM AGB tidak ditemukan: {config.model_path}")

            model = joblib.load(config.model_path)
            if not model.__class__.__module__.startswith("lightgbm."):
                raise TypeError(
                    "Artefak AGB harus berupa model LightGBM, ditemukan "
                    f"{model.__class__.__module__}.{model.__class__.__name__}"
                )

            model_features = getattr(model, "feature_name_", None)
            if not model_features or tuple(model_features) != config.features:
                raise ValueError(
                    "Urutan fitur model tidak sesuai kontrak: "
                    f"diharapkan {config.features}, ditemukan {tuple(model_features)}"
                )
            cls._model = model
            cls._model_version = config.version
            cls._model_path = config.model_path
            logger.info("Model ML Mangrove AGB v%s dimuat dari: %s", config.version, config.model_path)
        return cls._model

    @classmethod
    def predict_features(
        cls,
        vv: np.ndarray,
        vh: np.ndarray,
        ndvi: np.ndarray,
    ) -> np.ndarray:
        """
        Melakukan prediksi AGB (kg) dari array VV, VH, dan NDVI.
        Model LightGBM dilatih dengan urutan fitur persis: ['VV', 'VH', 'NDVI'].
        """
        vv_values, vh_values, ndvi_values = np.broadcast_arrays(
            np.asarray(vv, dtype=np.float64),
            np.asarray(vh, dtype=np.float64),
            np.asarray(ndvi, dtype=np.float64),
        )
        valid = valid_feature_mask(vv_values, vh_values, ndvi_values)
        predictions = np.full(vv_values.shape, np.nan, dtype=np.float64)
        if not np.any(valid):
            return predictions

        model = cls.get_model()
        config = get_active_model_config()
        available_features = {"VV": vv_values, "VH": vh_values, "NDVI": ndvi_values}
        df = pd.DataFrame(
            {feature: available_features[feature][valid] for feature in config.features},
            columns=config.features,
        )

        # Model outputs are kept only at valid feature locations; callers encode
        # the remaining pixels as the raster contract's nodata value.
        predictions[valid] = np.maximum(config.preprocessing["negative_prediction_floor"], model.predict(df))
        return predictions

    @classmethod
    def get_green_color(cls, value: float, min_val: float = 0, max_val: float | None = None) -> str:
        """
        Menghasilkan kode warna Hex gradasi hijau:
        Semakin besar nilainya maka warnanya semakin hijau pekat.
        Rentang: Kuning pupus (#ffffd4) -> Hijau muda (#d9f0a3) -> Hijau segar (#78c679) -> Hijau daun (#238443) -> Hijau hutan pekat (#004529)
        """
        if max_val is None:
            max_val = get_active_model_config().display_range["maximum"]
        if max_val <= min_val:
            max_val = min_val + 1

        norm = np.clip((value - min_val) / (max_val - min_val), 0, 1)

        palette = [
            (0.0, (255, 255, 212)),  # #ffffd4
            (0.2, (217, 240, 163)),  # #d9f0a3
            (0.4, (120, 198, 121)),  # #78c679
            (0.7, (35, 132, 67)),    # #238443
            (1.0, (0, 69, 41)),      # #004529
        ]

        # Interpolasi warna
        for i in range(len(palette) - 1):
            t0, c0 = palette[i]
            t1, c1 = palette[i + 1]
            if norm <= t1:
                ratio = (norm - t0) / (t1 - t0) if (t1 - t0) > 0 else 0
                r = int(c0[0] + ratio * (c1[0] - c0[0]))
                g = int(c0[1] + ratio * (c1[1] - c0[1]))
                b = int(c0[2] + ratio * (c1[2] - c0[2]))
                return f"#{r:02x}{g:02x}{b:02x}"

        return "#004529"

    @classmethod
    def process_sample_features(
        cls, 
        samples: List[Dict[str, Any]], 
        area_ha: float = 1.0
    ) -> Dict[str, Any]:
        """
        Menerima daftar piksel area dari GEE:
        Setiap item memiliki {'lat': ..., 'lng': ..., 'VV': ..., 'VH': ..., 'NDVI': ...}
        Menghasilkan:
        - Prediksi AGB_Revised_kg untuk setiap piksel
        - Kode warna hex gradasi hijau (semakin tinggi nilai AGB = semakin hijau pekat)
        - Statistik terverifikasi (min, max, mean kg, jumlah piksel)
        """
        if not samples:
            return {
                "points": [],
                "statistics": {
                    "min": 0, "max": 0, "mean": 0,
                    "pixel_count": 0,
                }
            }

        lats = np.array([s.get("lat", 0) for s in samples], dtype=float)
        lngs = np.array([s.get("lng", 0) for s in samples], dtype=float)
        vvs = np.array([s.get("VV", np.nan) for s in samples], dtype=float)
        vhs = np.array([s.get("VH", np.nan) for s in samples], dtype=float)
        ndvis = np.array([s.get("NDVI", np.nan) for s in samples], dtype=float)

        agb_preds = cls.predict_features(vvs, vhs, ndvis)

        valid = valid_feature_mask(vvs, vhs, ndvis)
        valid_predictions = agb_preds[valid]
        min_agb = float(np.min(valid_predictions)) if valid_predictions.size else 0.0
        max_agb = float(np.max(valid_predictions)) if valid_predictions.size else 0.0
        mean_agb = float(np.mean(valid_predictions)) if valid_predictions.size else 0.0

        processed_points = []
        for i in range(len(samples)):
            if not valid[i]:
                continue
            val = float(agb_preds[i])
            color = cls.get_green_color(val, min_agb, max_agb)
            processed_points.append({
                "lat": round(float(lats[i]), 6),
                "long": round(float(lngs[i]), 6),
                "ndvi": round(float(ndvis[i]), 6),
                "vv": round(float(vvs[i]), 4),
                "vh": round(float(vhs[i]), 4),
                "agb_revised_kg": round(val, 4),
                "color": color,
            })

        return {
            "points": processed_points,
            "statistics": {
                "min": round(min_agb, 2),
                "max": round(max_agb, 2),
                "mean": round(mean_agb, 2),
                "pixel_count": len(processed_points),
            }
        }

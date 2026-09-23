import os
import logging
# pyrefly: ignore [missing-import]
import joblib
import numpy as np
import pandas as pd
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

class MlAgbService:
    _model = None

    @classmethod
    def get_model(cls):
        """
        Memuat model LightGBM Regressor sebagai singleton.
        """
        if cls._model is None:
            candidate_paths = [
                os.path.join(os.path.dirname(__file__), "..", "..", "model", "best_mangrove_agb_model.joblib"),
                "/app/model/best_mangrove_agb_model.joblib",
                os.path.join(os.getcwd(), "model", "best_mangrove_agb_model.joblib"),
                os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "model", "best_mangrove_agb_model.joblib")),
            ]
            loaded_path = None
            for p in candidate_paths:
                norm_p = os.path.normpath(p)
                if os.path.exists(norm_p):
                    try:
                        cls._model = joblib.load(norm_p)
                        loaded_path = norm_p
                        logger.info(f"Berhasil memuat model ML Mangrove AGB dari: {norm_p}")
                        break
                    except Exception as e:
                        logger.warning(f"Gagal memuat model dari {norm_p}: {e}")

            if cls._model is None:
                logger.error("Berkas best_mangrove_agb_model.joblib tidak ditemukan pada jalur kandidat manapun.")
        return cls._model

    @classmethod
    def predict_features(cls, vv: np.ndarray, vh: np.ndarray, ndvi: np.ndarray) -> np.ndarray:
        """
        Melakukan prediksi AGB (kg) dari array VV, VH, dan NDVI.
        Model LightGBM dilatih dengan urutan fitur persis: ['VV', 'VH', 'NDVI'].
        """
        model = cls.get_model()
        if model is None:
            # Fallback jika model tidak ditemukan: rumus empiris estimasi biomassa kanopi
            return np.maximum(0, 115 * np.exp(1.65 * ndvi) - 60)

        df = pd.DataFrame({
            "VV": vv,
            "VH": vh,
            "NDVI": ndvi
        })

        preds = model.predict(df)
        # Pastikan tidak ada nilai biomassa negatif
        return np.maximum(0, preds)

    @classmethod
    def get_green_color(cls, value: float, min_val: float = 0, max_val: float = 2500) -> str:
        """
        Menghasilkan kode warna Hex gradasi hijau:
        Semakin besar nilainya maka warnanya semakin hijau pekat.
        Rentang: Kuning pupus (#ffffd4) -> Hijau muda (#d9f0a3) -> Hijau segar (#78c679) -> Hijau daun (#238443) -> Hijau hutan pekat (#004529)
        """
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
        vvs = np.array([s.get("VV", -12.0) for s in samples], dtype=float)
        vhs = np.array([s.get("VH", -18.0) for s in samples], dtype=float)
        ndvis = np.array([s.get("NDVI", 0.5) for s in samples], dtype=float)

        agb_preds = cls.predict_features(vvs, vhs, ndvis)

        min_agb = float(np.min(agb_preds)) if len(agb_preds) > 0 else 0.0
        max_agb = float(np.max(agb_preds)) if len(agb_preds) > 0 else 0.0
        mean_agb = float(np.mean(agb_preds)) if len(agb_preds) > 0 else 0.0

        processed_points = []
        for i in range(len(samples)):
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

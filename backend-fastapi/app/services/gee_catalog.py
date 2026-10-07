"""Visualization palettes and supported satellite dataset metadata."""

# Palette standar untuk visualisasi GEE & SLD
PALETTES = {
    "ndvi": {
        "min": -0.1,
        "max": 0.85,
        "colors": ["#d73027", "#f46d43", "#fdae61", "#fee08b", "#d9ef8b", "#a6d96a", "#66bd63", "#1a9850", "#006837"],
        "labels": ["Non-Vegetasi / Air", "Sangat Rendah", "Rendah", "Cukup", "Sedang", "Bagus", "Tinggi", "Lebat", "Mangrove Sangat Lebat"],
        "style_type": "ramp",
        "unit": "Indeks (-1 s/d 1)",
    },
    "evi": {
        "min": 0.0,
        "max": 0.8,
        "colors": ["#a50026", "#d73027", "#fdae61", "#fee08b", "#a6d96a", "#66bd63", "#1a9850", "#006837"],
        "labels": ["Terbuka", "Minimal", "Rendah", "Sedang", "Bagus", "Tinggi", "Sangat Tinggi", "Kanopi Maksimal"],
        "style_type": "ramp",
        "unit": "Indeks (EVI)",
    },
    "savi": {
        "min": 0.0,
        "max": 0.75,
        "colors": ["#8c510a", "#d8b365", "#f6e8c3", "#c7eae5", "#5ab4ac", "#01665e"],
        "labels": ["Lumpur/Tanah", "Transisi", "Vegetasi Awal", "Sedang", "Bagus", "Mangrove Sehat"],
        "style_type": "ramp",
        "unit": "Indeks (SAVI)",
    },
    "ndwi": {
        "min": -0.5,
        "max": 0.5,
        "colors": ["#8c510a", "#f6e8c3", "#c7eae5", "#41b6c4", "#225ea8", "#081d58"],
        "labels": ["Vegetasi Kering", "Daratan", "Lembab", "Permukaan Air Dangkal", "Badan Air", "Air Dalam"],
        "style_type": "ramp",
        "unit": "Indeks (NDWI)",
    },
    "mndwi": {
        "min": -0.6,
        "max": 0.6,
        "colors": ["#8c510a", "#dfc27d", "#f6e8c3", "#c7eae5", "#80cdc1", "#018571"],
        "labels": ["Daratan", "Pesisir Kering", "Garis Pantai", "Genangan Pasang", "Saluran Estuari", "Badan Air Utama"],
        "style_type": "ramp",
        "unit": "Indeks (MNDWI)",
    },
    "cmri": {
        "min": 0.0,
        "max": 1.2,
        "colors": ["#440154", "#3b528b", "#21908c", "#5dc863", "#fde725"],
        "labels": ["Bukan Mangrove", "Probabilitas Rendah", "Mangrove Campuran", "Mangrove Dominan", "Mangrove Inti Murni"],
        "style_type": "ramp",
        "unit": "Indeks (CMRI)",
    },
    "agb": {
        "min": 0.0,
        "max": 2500.0,
        "colors": ["#ffffd4", "#d9f0a3", "#78c679", "#41ab5d", "#238443", "#004529"],
        "labels": [
            "< 250 kg (Sangat Rendah)",
            "250 - 750 kg (Rendah)",
            "750 - 1.250 kg (Sedang)",
            "1.250 - 1.750 kg (Bagus)",
            "1.750 - 2.250 kg (Tinggi/Lebat)",
            "> 2.250 kg (Sangat Lebat/Optimal)"
        ],
        "style_type": "ramp",
        "unit": "kg (AGB)",
    },
}

# Katalog Satelit untuk Ekstraksi Dataset Riset & Pelatihan Model Machine Learning
SATELLITES_CATALOG = {
    "sentinel2": {
        "id": "sentinel2",
        "name": "Sentinel-2 MSI (Level-2A Harmonized)",
        "agency": "ESA (European Space Agency)",
        "collection": "COPERNICUS/S2_SR_HARMONIZED",
        "type": "optical",
        "description": "Multispektral resolusi tinggi (10m-20m) dengan band Red-Edge dan SWIR, sangat ideal untuk model klasifikasi tutupan kanopi mangrove dan kesehatan vegetasi.",
        "native_scale": 10,
        "default_rgb": ["B4", "B3", "B2"],
        "default_false_color": ["B8", "B4", "B3"],
        "bands": [
            {"id": "B2", "name": "B2 - Blue", "wavelength": "490 nm", "resolution": "10m", "desc": "Reflektansi biru, penyerapan klorofil & penetrasi air jernih"},
            {"id": "B3", "name": "B3 - Green", "wavelength": "560 nm", "resolution": "10m", "desc": "Reflektansi hijau, puncak pantulan daun sehat"},
            {"id": "B4", "name": "B4 - Red", "wavelength": "665 nm", "resolution": "10m", "desc": "Reflektansi merah, penyerapan kuat klorofil a/b"},
            {"id": "B5", "name": "B5 - Red Edge 1", "wavelength": "705 nm", "resolution": "20m", "desc": "Batas transisi penyerapan merah ke pantulan NIR"},
            {"id": "B6", "name": "B6 - Red Edge 2", "wavelength": "740 nm", "resolution": "20m", "desc": "Sensitif terhadap konsentrasi klorofil kanopi"},
            {"id": "B7", "name": "B7 - Red Edge 3", "wavelength": "783 nm", "resolution": "20m", "desc": "Sensitif terhadap struktur seluler dan biomassa"},
            {"id": "B8", "name": "B8 - NIR (Broad)", "wavelength": "842 nm", "resolution": "10m", "desc": "Near-infrared lebar, pantulan struktur sel mesofil daun"},
            {"id": "B8A", "name": "B8A - NIR (Narrow)", "wavelength": "865 nm", "resolution": "20m", "desc": "Near-infrared sempit, meminimalkan uap air atmosfer"},
            {"id": "B11", "name": "B11 - SWIR 1", "wavelength": "1610 nm", "resolution": "20m", "desc": "Kadar air kanopi daun dan pemisah tanah/lumpur basah"},
            {"id": "B12", "name": "B12 - SWIR 2", "wavelength": "2190 nm", "resolution": "20m", "desc": "Karakterisasi kelembaban dan substrat pesisir"},
        ],
        "presets": [
            {"id": "rgb", "name": "True Color (RGB)", "bands": ["B4", "B3", "B2"], "desc": "Warna alami menyerupai penglihatan mata manusia"},
            {"id": "false_color", "name": "Color Infrared (NIR-R-G)", "bands": ["B8", "B4", "B3"], "desc": "Vegetasi mangrove tampak merah menyala, membedakan kerapatan tajuk"},
            {"id": "mangrove_ml", "name": "Mangrove ML Kit (10 Bands)", "bands": ["B2", "B3", "B4", "B5", "B6", "B7", "B8", "B8A", "B11", "B12"], "desc": "Paket komplit 10 band spektral esensial untuk pelatihan model Deep Learning / Random Forest"},
            {"id": "swir_moisture", "name": "Moisture Analysis (SWIR-NIR-R)", "bands": ["B11", "B8", "B4"], "desc": "Kombinasi analisis kadar air dan genangan pesisir"},
        ]
    },
    "landsat89": {
        "id": "landsat89",
        "name": "Landsat 8/9 OLI-2 (Level-2 SR)",
        "agency": "USGS / NASA",
        "collection": "LANDSAT/LC08/C02/T1_L2 & LC09/C02/T1_L2",
        "type": "optical_thermal",
        "description": "Multispektral 30m dengan band termal permukaan (LST), sangat baik untuk riset deret waktu historis (time-series) dan dinamika termal ekosistem pesisir.",
        "native_scale": 30,
        "default_rgb": ["SR_B4", "SR_B3", "SR_B2"],
        "default_false_color": ["SR_B5", "SR_B4", "SR_B3"],
        "bands": [
            {"id": "SR_B1", "name": "SR_B1 - Coastal/Aerosol", "wavelength": "443 nm", "resolution": "30m", "desc": "Pesisir pantai dangkal & partikel aerosol atmosfer"},
            {"id": "SR_B2", "name": "SR_B2 - Blue", "wavelength": "482 nm", "resolution": "30m", "desc": "Reflektansi biru, pemetaan batimetri dangkal"},
            {"id": "SR_B3", "name": "SR_B3 - Green", "wavelength": "561 nm", "resolution": "30m", "desc": "Reflektansi hijau vegetasi dan turbiditas air"},
            {"id": "SR_B4", "name": "SR_B4 - Red", "wavelength": "655 nm", "resolution": "30m", "desc": "Penyerapan klorofil merah"},
            {"id": "SR_B5", "name": "SR_B5 - NIR", "wavelength": "865 nm", "resolution": "30m", "desc": "Near-infrared, kerapatan vegetasi darat & mangrove"},
            {"id": "SR_B6", "name": "SR_B6 - SWIR 1", "wavelength": "1609 nm", "resolution": "30m", "desc": "Kandungan air tanaman dan pembedaan tanah kering/basah"},
            {"id": "SR_B7", "name": "SR_B7 - SWIR 2", "wavelength": "2201 nm", "resolution": "30m", "desc": "Geologi pesisir dan kadar kelembaban tanah"},
            {"id": "ST_B10", "name": "ST_B10 - Thermal (LST)", "wavelength": "10.9 µm", "resolution": "30m*", "desc": "Suhu permukaan daratan/air (Land Surface Temperature)"},
        ],
        "presets": [
            {"id": "rgb", "name": "True Color (RGB)", "bands": ["SR_B4", "SR_B3", "SR_B2"], "desc": "Warna alami standar Landsat"},
            {"id": "false_color", "name": "Color Infrared (NIR-R-G)", "bands": ["SR_B5", "SR_B4", "SR_B3"], "desc": "Vegetasi mangrove tampak cerah kontras dengan perairan"},
            {"id": "all_optical", "name": "All Bands + Thermal", "bands": ["SR_B1", "SR_B2", "SR_B3", "SR_B4", "SR_B5", "SR_B6", "SR_B7", "ST_B10"], "desc": "Seluruh band optik dan suhu termal permukaan"},
        ]
    },
    "sentinel1": {
        "id": "sentinel1",
        "name": "Sentinel-1 SAR GRD (C-Band Radar)",
        "agency": "ESA (European Space Agency)",
        "collection": "COPERNICUS/S1_GRD",
        "type": "sar",
        "description": "Radar Apertur Sintetis (SAR) C-Band 10m yang mampu menembus awan dan cuaca ekstrem. Sangat krusial untuk melatih model struktur kerapatan biomassa berkayu dan genangan air di bawah kanopi.",
        "native_scale": 10,
        "default_rgb": ["VV", "VH", "VV"],
        "default_false_color": ["VV", "VH", "angle"],
        "bands": [
            {"id": "VV", "name": "VV - Vertical Polarisation", "wavelength": "C-Band (5.405 GHz)", "resolution": "10m", "desc": "Hamburan balik vertikal, sensitif terhadap permukaan tanah/air dan batang vertikal"},
            {"id": "VH", "name": "VH - Cross Polarisation", "wavelength": "C-Band (5.405 GHz)", "resolution": "10m", "desc": "Hamburan silang, sangat sensitif terhadap hamburan volume kanopi daun dan ranting mangrove"},
            {"id": "angle", "name": "Incidence Angle", "wavelength": "Degrees (°)", "resolution": "10m", "desc": "Sudut datang gelombang radar untuk normalisasi efek geometri"},
        ],
        "presets": [
            {"id": "dual_pol", "name": "Dual Polarization (VV + VH)", "bands": ["VV", "VH"], "desc": "Dua polarisasi utama untuk analisis struktur vegetasi dan air"},
            {"id": "all", "name": "Full SAR (VV + VH + Angle)", "bands": ["VV", "VH", "angle"], "desc": "Dataset SAR lengkap untuk pelatihan model radar deep learning"},
        ]
    }
}

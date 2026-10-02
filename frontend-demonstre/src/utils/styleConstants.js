// Standard Color Ramp palettes (AstraGIS aligned)
export const COLOR_RAMP_PREVIEWS = [
  {
    id: "cyan_blue_magenta",
    name: "Cyan → Blue → Magenta",
    colors: ["#00e5ff", "#0044ff", "#ff00ee"],
  },
  {
    id: "greens",
    name: "Greens (Mangrove / Biomass / NDVI)",
    colors: ["#edf8fb", "#b2e2e2", "#66c2a4", "#2ca25f", "#006d2c"],
  },
  {
    id: "viridis",
    name: "Viridis (Scientific Perceptual)",
    colors: ["#440154", "#3b528b", "#21908c", "#5dc863", "#fde725"],
  },
  {
    id: "spectral",
    name: "Spectral (Multi-Class / Rainbow)",
    colors: ["#2b83ba", "#abdda4", "#ffffbf", "#fdae61", "#d7191c"],
  },
  {
    id: "blues",
    name: "Blues (Hydrology / Water Body)",
    colors: ["#eff3ff", "#bdd7e7", "#6baed6", "#3182bd", "#08519c"],
  },
  {
    id: "traffic_light",
    name: "Traffic Light (Green → Yellow → Red)",
    colors: ["#1a9641", "#a6d96a", "#ffffbf", "#fdae61", "#d7191c"],
  },
  {
    id: "magma",
    name: "Magma (Heat / High Contrast)",
    colors: ["#000004", "#51127c", "#b73779", "#fb8861", "#fcfdbf"],
  },
  {
    id: "reds",
    name: "Reds (Hazard / Vulnerability)",
    colors: ["#fee5d9", "#fcae91", "#fb6a4a", "#de2d26", "#a50f15"],
  },
  {
    id: "terrain",
    name: "Terrain (Elevation / Coastal)",
    colors: ["#33a02c", "#b2df8a", "#ffff99", "#fdbf6f", "#ff7f00", "#e31a1c"],
  },
];

// Presets untuk template klasifikasi cepat
export const PRESETS = [
  {
    id: "mangrove_ndvi",
    name: "Mangrove Density / NDVI",
    description: "Klasifikasi tutupan dan kerapatan mangrove",
    styleType: "intervals",
    classes: [
      { min: -1.0, max: 0.0, quantity: 0.0, color: "#004da8", opacity: 0.0, label: "Air / No Data" },
      { min: 0.0, max: 0.2, quantity: 0.2, color: "#e7d8b1", opacity: 0.9, label: "Lahan Terbuka (<0.2)" },
      { min: 0.2, max: 0.4, quantity: 0.4, color: "#fcd34d", opacity: 0.95, label: "Vegetasi Rendah (0.2-0.4)" },
      { min: 0.4, max: 0.6, quantity: 0.6, color: "#34d399", opacity: 1.0, label: "Mangrove Sedang (0.4-0.6)" },
      { min: 0.6, max: 1.0, quantity: 1.0, color: "#047857", opacity: 1.0, label: "Mangrove Lebat (>0.6)" },
    ],
  },
  {
    id: "biomass_carbon",
    name: "Biomass / Carbon Stock (t/ha)",
    description: "Estimasi cadangan biomassa/karbon per hektar",
    styleType: "intervals",
    classes: [
      { min: 0, max: 50, quantity: 50, color: "#edf8fb", opacity: 0.8, label: "Sangat Rendah (0-50 t/ha)" },
      { min: 50, max: 100, quantity: 100, color: "#b2e2e2", opacity: 0.85, label: "Rendah (50-100 t/ha)" },
      { min: 100, max: 200, quantity: 200, color: "#66c2a4", opacity: 0.9, label: "Sedang (100-200 t/ha)" },
      { min: 200, max: 350, quantity: 350, color: "#2ca25f", opacity: 0.95, label: "Tinggi (200-350 t/ha)" },
      { min: 350, max: 600, quantity: 600, color: "#006d2c", opacity: 1.0, label: "Sangat Tinggi (>350 t/ha)" },
    ],
  },
  {
    id: "elevation",
    name: "Elevasi Pesisir / DEM",
    description: "Gradasi ketinggian daratan & pesisir",
    styleType: "intervals",
    classes: [
      { min: -10, max: 0, quantity: 0, color: "#0284c7", opacity: 0.8, label: "Permukaan Laut (0 m)" },
      { min: 0, max: 10, quantity: 10, color: "#22c55e", opacity: 0.9, label: "Pesisir Rendah (0-10 m)" },
      { min: 10, max: 50, quantity: 50, color: "#eab308", opacity: 0.95, label: "Dataran Rendah (10-50 m)" },
      { min: 50, max: 150, quantity: 150, color: "#d97706", opacity: 1.0, label: "Perbukitan (50-150 m)" },
      { min: 150, max: 500, quantity: 500, color: "#b45309", opacity: 1.0, label: "Dataran Tinggi (>150 m)" },
    ],
  },
  {
    id: "flood_risk",
    name: "Tingkat Risiko Banjir Rob / Genangan",
    description: "Gradasi bahaya dari aman ke kritis",
    styleType: "values",
    classes: [
      { min: 0, max: 0, quantity: 0, color: "#000000", opacity: 0.0, label: "Tidak Terdampak" },
      { min: 1, max: 1, quantity: 1, color: "#2b83ba", opacity: 1.0, label: "Sangat Rendah" },
      { min: 2, max: 2, quantity: 2, color: "#abdda4", opacity: 1.0, label: "Rendah" },
      { min: 3, max: 3, quantity: 3, color: "#ffffbf", opacity: 1.0, label: "Sedang" },
      { min: 4, max: 4, quantity: 4, color: "#fdae61", opacity: 1.0, label: "Tinggi" },
      { min: 5, max: 5, quantity: 5, color: "#d7191c", opacity: 1.0, label: "Sangat Tinggi" },
    ],
  },
  {
    id: "viridis",
    name: "Viridis (Scientific Ramp)",
    description: "Skala saintifik seragam persepsi",
    styleType: "ramp",
    classes: [
      { min: 0, max: 0, quantity: 0, color: "#000000", opacity: 0.0, label: "Min / 0" },
      { min: 1, max: 1, quantity: 1, color: "#440154", opacity: 1.0, label: "Level 1" },
      { min: 2, max: 2, quantity: 2, color: "#3b528b", opacity: 1.0, label: "Level 2" },
      { min: 3, max: 3, quantity: 3, color: "#21908c", opacity: 1.0, label: "Level 3" },
      { min: 4, max: 4, quantity: 4, color: "#5dc863", opacity: 1.0, label: "Level 4" },
      { min: 5, max: 5, quantity: 5, color: "#fde725", opacity: 1.0, label: "Level 5" },
    ],
  },
];

export const STORAGE_CUSTOM_RAMPS_KEY = "biomass_custom_color_ramps";

export const loadSavedCustomRamps = () => {
  try {
    const raw = localStorage.getItem(STORAGE_CUSTOM_RAMPS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveCustomRampsToStorage = (ramps) => {
  try {
    localStorage.setItem(STORAGE_CUSTOM_RAMPS_KEY, JSON.stringify(ramps));
  } catch (e) {
    console.error("Gagal menyimpan custom color ramps:", e);
  }
};

// Interpolasi warna hex
export function interpolateColor(color1, color2, factor) {
  const c1 = parseInt(color1.replace("#", ""), 16);
  const c2 = parseInt(color2.replace("#", ""), 16);
  const r1 = (c1 >> 16) & 255, g1 = (c1 >> 8) & 255, b1 = c1 & 255;
  const r2 = (c2 >> 16) & 255, g2 = (c2 >> 8) & 255, b2 = c2 & 255;
  const r = Math.round(r1 + factor * (r2 - r1));
  const g = Math.round(g1 + factor * (g2 - g1));
  const b = Math.round(b1 + factor * (b2 - b1));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

// Mengambil N warna halus dari Color Ramp
export function sampleRampColors(baseColors, count) {
  if (!baseColors || baseColors.length === 0) return Array(count).fill("#00e5ff");
  if (count <= 1) return [baseColors[0]];
  if (baseColors.length === 1) return Array(count).fill(baseColors[0]);

  const result = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const pos = t * (baseColors.length - 1);
    const idx = Math.floor(pos);
    const frac = pos - idx;
    if (idx >= baseColors.length - 1) {
      result.push(baseColors[baseColors.length - 1]);
    } else {
      result.push(interpolateColor(baseColors[idx], baseColors[idx + 1], frac));
    }
  }
  return result;
}

// Menghitung titik batas (breaks) statistik
export function calculateBreaks(min, max, count, method = "jenks") {
  const c = Math.max(1, Number(count) || 5);
  const start = Number(min) || 0;
  const end = Number(max) || 100;
  const range = end - start;

  if (range <= 0) {
    const breaks = [];
    for (let i = 0; i <= c; i++) {
      breaks.push(Number((start + i).toFixed(2)));
    }
    return breaks;
  }

  const breaks = [start];
  for (let i = 1; i < c; i++) {
    const t = i / c;
    let val;
    if (method === "jenks") {
      const curved = Math.pow(t, 1.25);
      val = start + curved * range;
    } else if (method === "quantile") {
      const curved = 0.5 * (1 + Math.sin((t - 0.5) * Math.PI));
      val = start + curved * range;
    } else {
      // equal_interval
      val = start + t * range;
    }
    breaks.push(Number(val.toFixed(2)));
  }
  breaks.push(Number(end.toFixed(2)));
  return breaks;
}

// DRY Classification Engine
export function generateClassificationClasses({ min, max, count, method = "jenks", colors }) {
  const n = Math.max(1, Number(count) || 5);
  const breaks = calculateBreaks(min, max, n, method);
  const rampColors = sampleRampColors(colors, n);
  const classes = [];

  for (let i = 0; i < n; i++) {
    const minVal = breaks[i];
    const maxVal = breaks[i + 1] !== undefined ? breaks[i + 1] : minVal;
    classes.push({
      min: minVal,
      max: maxVal,
      quantity: maxVal,
      color: rampColors[i] || "#00e5ff",
      opacity: 1.0,
      label: `${minVal} - ${maxVal}`,
    });
  }
  return classes;
}

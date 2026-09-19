import axiosClient from '../api/AxiosClient'

/**
 * Utilitas untuk Parsing & Ekspor Berkas AOI (Area of Interest)
 * Mendukung GeoJSON (.geojson, .json), CSV (.csv), dan Shapefile (.zip, .shp)
 */

// ── 1. PARSER GEOJSON ────────────────────────────────────────────────────────
export function parseGeoJsonAoi(jsonContent) {
  let data
  try {
    data = typeof jsonContent === 'string' ? JSON.parse(jsonContent) : jsonContent
  } catch (err) {
    throw new Error('Format berkas GeoJSON tidak valid (gagal di-parse sebagai JSON).')
  }

  let coordinates = []

  // Ekstrak geometri dari berbagai tipe struktur GeoJSON
  if (data.type === 'FeatureCollection' && Array.isArray(data.features) && data.features.length > 0) {
    const geom = data.features[0].geometry
    coordinates = extractCoordsFromGeometry(geom)
  } else if (data.type === 'Feature' && data.geometry) {
    coordinates = extractCoordsFromGeometry(data.geometry)
  } else if (data.type === 'Polygon' || data.type === 'MultiPolygon') {
    coordinates = extractCoordsFromGeometry(data)
  } else {
    throw new Error('Struktur GeoJSON tidak memiliki geometri Polygon yang valid.')
  }

  if (!coordinates || coordinates.length < 3) {
    throw new Error('Poligon dalam berkas GeoJSON harus memiliki minimal 3 titik koordinat.')
  }

  // GeoJSON standar adalah [lng, lat], ubah ke format Leaflet [lat, lng]
  const leafletPoints = coordinates.map((pt) => {
    const lng = parseFloat(pt[0])
    const lat = parseFloat(pt[1])
    if (isNaN(lat) || isNaN(lng)) {
      throw new Error('Ditemukan koordinat numerik yang tidak valid di dalam GeoJSON.')
    }
    return [lat, lng]
  })

  // Hapus titik penutup duplikat jika ada (agar Leaflet array tidak ganda)
  if (
    leafletPoints.length > 3 &&
    leafletPoints[0][0] === leafletPoints[leafletPoints.length - 1][0] &&
    leafletPoints[0][1] === leafletPoints[leafletPoints.length - 1][1]
  ) {
    leafletPoints.pop()
  }

  return leafletPoints
}

function extractCoordsFromGeometry(geom) {
  if (!geom || !geom.coordinates) return null
  if (geom.type === 'Polygon') {
    // Ambil exterior ring pertama
    return geom.coordinates[0]
  } else if (geom.type === 'MultiPolygon') {
    // Ambil exterior ring poligon pertama
    return geom.coordinates[0][0]
  }
  return null
}

// ── 2. PARSER CSV ────────────────────────────────────────────────────────────
export function parseCsvAoi(csvText) {
  if (!csvText || typeof csvText !== 'string') {
    throw new Error('Konten berkas CSV kosong.')
  }

  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  if (lines.length < 3) {
    throw new Error('Berkas CSV minimal harus memiliki 3 baris titik koordinat.')
  }

  // Deteksi separator (koma, titik-koma, atau tab)
  const firstLine = lines[0]
  let delimiter = ','
  if (firstLine.includes(';') && firstLine.split(';').length >= 2) delimiter = ';'
  else if (firstLine.includes('\t') && firstLine.split('\t').length >= 2) delimiter = '\t'

  // Periksa apakah baris pertama adalah header
  const headerCols = lines[0].split(delimiter).map((c) => c.toLowerCase().trim().replace(/['"]/g, ''))
  
  let latIdx = -1
  let lngIdx = -1

  headerCols.forEach((col, idx) => {
    if (['latitude', 'lat', 'y', 'lintang'].includes(col)) latIdx = idx
    if (['longitude', 'long', 'lon', 'lng', 'x', 'bujur'].includes(col)) lngIdx = idx
  })

  let startLine = 0
  if (latIdx !== -1 && lngIdx !== -1) {
    startLine = 1 // Baris 0 adalah header
  } else {
    // Tanpa header atau header tidak dikenali -> asumsikan kolom 0 = lat, kolom 1 = lng
    // Cek apakah baris 0 angka
    const testRow = lines[0].split(delimiter).map((v) => parseFloat(v.trim()))
    if (!isNaN(testRow[0]) && !isNaN(testRow[1])) {
      latIdx = 0
      lngIdx = 1
      startLine = 0
    } else {
      // Baris 0 string header, gunakan kolom 0 dan 1 untuk baris selanjutnya
      latIdx = 0
      lngIdx = 1
      startLine = 1
    }
  }

  const points = []
  for (let i = startLine; i < lines.length; i++) {
    const cols = lines[i].split(delimiter).map((c) => c.trim().replace(/['"]/g, ''))
    if (cols.length < 2) continue

    const lat = parseFloat(cols[latIdx])
    const lng = parseFloat(cols[lngIdx])

    if (!isNaN(lat) && !isNaN(lng)) {
      points.push([lat, lng])
    }
  }

  if (points.length < 3) {
    throw new Error('Gagal mengekstrak minimal 3 titik koordinat valid dari berkas CSV.')
  }

  // Hapus titik penutup duplikat jika ada
  if (
    points.length > 3 &&
    points[0][0] === points[points.length - 1][0] &&
    points[0][1] === points[points.length - 1][1]
  ) {
    points.pop()
  }

  return points
}

// ── 3. PARSER SHAPEFILE (.ZIP / .SHP / MULTI-SELECT .SHP + .PRJ) ─────────────
export async function parseShapefileViaBackend(fileOrFiles) {
  const fileList = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles]
  if (fileList.length === 0) {
    throw new Error('Berkas Shapefile tidak ditemukan.')
  }

  const formData = new FormData()
  for (const f of fileList) {
    formData.append('files', f)
  }
  // Sertakan 'file' untuk kompatibilitas jika hanya satu berkas
  if (fileList.length === 1) {
    formData.append('file', fileList[0])
  }

  const res = await axiosClient.post('/parse-shapefile', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  if (res.data && res.data.points && res.data.points.length >= 3) {
    return res.data.points
  }
  throw new Error(res.data?.detail || 'Gagal mengekstrak koordinat dari berkas Shapefile.')
}

export async function parseShapefileAoi(fileOrFiles) {
  const fileList = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles]
  if (!fileList || fileList.length === 0) {
    throw new Error('Berkas Shapefile tidak ditemukan.')
  }

  // Periksa apakah terdapat berkas .shp atau .zip di antara berkas yang dipilih
  const hasShpOrZip = fileList.some((f) => {
    const n = f.name.toLowerCase()
    return n.endsWith('.shp') || n.endsWith('.zip')
  })

  if (!hasShpOrZip) {
    throw new Error(
      'Tidak ditemukan berkas .shp atau .zip di antara berkas yang dipilih. Pastikan menyertakan berkas berekstensi .shp (dan .prj).'
    )
  }

  // Menggunakan layanan backend FastAPI GeoPandas (GDAL + PyOGRIO).
  // Keunggulan: Otomatis mendeteksi dan mereproyeksi CRS (misal UTM Zone 48S/50S) ke WGS84,
  // mengekstrak arsip ZIP atau menggabungkan berkas multi-select (.shp + .prj + .shx + .dbf).
  return await parseShapefileViaBackend(fileList)
}

// ── 4. EKSPOR KE GEOJSON ─────────────────────────────────────────────────────
export function exportAoiToGeoJson(points, areaHectares = 0, customName = 'Mangrove_AOI') {
  if (!points || points.length < 3) return null

  // Leaflet [lat, lng] -> GeoJSON [lng, lat]
  const ring = points.map((p) => [p[1], p[0]])
  // Pastikan ring tertutup di GeoJSON
  if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
    ring.push([ring[0][0], ring[0][1]])
  }

  const geojson = {
    type: 'FeatureCollection',
    name: customName,
    crs: {
      type: 'name',
      properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' },
    },
    features: [
      {
        type: 'Feature',
        properties: {
          name: customName,
          area_hectares: parseFloat(areaHectares.toFixed(2)),
          area_m2: parseFloat((areaHectares * 10000).toFixed(1)),
          vertex_count: points.length,
          created_at: new Date().toISOString(),
          exported_by: 'Biomass Mangrove GIS',
        },
        geometry: {
          type: 'Polygon',
          coordinates: [ring],
        },
      },
    ],
  }

  return JSON.stringify(geojson, null, 2)
}

// ── 4. EKSPOR KE CSV ─────────────────────────────────────────────────────────
export function exportAoiToCsv(points, areaHectares = 0, customName = 'Mangrove_AOI') {
  if (!points || points.length === 0) return null

  const headers = ['point_index', 'latitude', 'longitude', 'wkt_point', 'area_hectares_total']
  const rows = points.map((p, idx) => {
    return [
      idx + 1,
      p[0].toFixed(6),
      p[1].toFixed(6),
      `"POINT(${p[1].toFixed(6)} ${p[0].toFixed(6)})"`,
      idx === 0 ? areaHectares.toFixed(2) : '',
    ].join(',')
  })

  return [headers.join(','), ...rows].join('\n')
}

// ── 5. CLIENT-SIDE FILE DOWNLOAD TRIGGER ─────────────────────────────────────
export function triggerBrowserDownload(content, filename, mimeType = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: `${mimeType};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// ── 6. EKSPOR KE SHAPEFILE (.ZIP) ───────────────────────────────────────────
export async function exportAoiToShapefile(points, areaHectares = 0, customName = 'Mangrove_AOI') {
  if (!points || points.length < 3) {
    throw new Error('Area poligon tidak valid.')
  }

  const cleanName = (customName || 'Mangrove_AOI').trim().replace(/[^a-zA-Z0-9_\-]/g, '_')
  const payload = {
    points,
    name: cleanName,
    area_hectares: areaHectares,
  }

  const res = await axiosClient.post('/export-shapefile', payload, {
    responseType: 'blob',
  })

  triggerBrowserDownload(res.data, `${cleanName}.zip`, 'application/zip')
  return true
}


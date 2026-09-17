import proj4 from 'proj4'

// Built-in definitions untuk proyeksi umum di Asia Tenggara / Indonesia / Thailand
// Ini memastikan reprojection tetap bekerja sangat cepat dan offline/tanpa latency jaringan
const BUILTIN_PROJECTIONS = {
  '4326': '+proj=longlat +datum=WGS84 +no_defs +type=crs',
  '3857': '+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs +type=crs',
  '900913': '+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs +type=crs',
  // Thailand UTM
  '32647': '+proj=utm +zone=47 +datum=WGS84 +units=m +no_defs',
  '32648': '+proj=utm +zone=48 +datum=WGS84 +units=m +no_defs',
  // Indonesia UTM
  '32746': '+proj=utm +zone=46 +south +datum=WGS84 +units=m +no_defs',
  '32747': '+proj=utm +zone=47 +south +datum=WGS84 +units=m +no_defs',
  '32748': '+proj=utm +zone=48 +south +datum=WGS84 +units=m +no_defs',
  '32749': '+proj=utm +zone=49 +south +datum=WGS84 +units=m +no_defs',
  '32750': '+proj=utm +zone=50 +south +datum=WGS84 +units=m +no_defs',
  '32751': '+proj=utm +zone=51 +south +datum=WGS84 +units=m +no_defs',
  '32752': '+proj=utm +zone=52 +south +datum=WGS84 +units=m +no_defs',
  '32753': '+proj=utm +zone=53 +south +datum=WGS84 +units=m +no_defs',
  '32754': '+proj=utm +zone=54 +south +datum=WGS84 +units=m +no_defs',
}

// Inisialisasi built-in defs ke proj4
Object.entries(BUILTIN_PROJECTIONS).forEach(([code, def]) => {
  try {
    proj4.defs(`EPSG:${code}`, def)
  } catch (err) {
    console.warn(`Failed to register proj4 built-in EPSG:${code}`, err)
  }
})

// Cache definisi proj4 dari internet agar tidak fetch berkali-kali untuk EPSG yang sama
const epsgCache = { ...BUILTIN_PROJECTIONS }

/**
 * Konversi Bounding Box (BBox) dari sembarang proyeksi EPSG ke WGS84 (EPSG:4326 - lat/lng)
 * @param {Array<number>} bbox - [minx, miny, maxx, maxy]
 * @param {number|string} epsg - kode EPSG (misal 32647, 3857, 4326)
 * @returns {Promise<{minLng: number, minLat: number, maxLng: number, maxLat: number}|null>}
 */
export async function bboxToWGS84(bbox, epsg) {
  if (!Array.isArray(bbox) || bbox.length < 4 || bbox.some((v) => v == null || isNaN(v))) {
    return null
  }

  const [minx, miny, maxx, maxy] = bbox

  // Bersihkan format string EPSG
  let cleanEpsg = epsg ? String(epsg).replace(/^EPSG:/i, '').trim() : '4326'

  // Validasi heuristik: Jika diklaim 4326 tapi nilainya jelas proyeksi meter (> 180 atau < -180)
  if (cleanEpsg === '4326') {
    const isDegree =
      Math.abs(minx) <= 180 &&
      Math.abs(miny) <= 90 &&
      Math.abs(maxx) <= 180 &&
      Math.abs(maxy) <= 90

    if (isDegree) {
      return {
        minLng: Math.min(minx, maxx),
        minLat: Math.min(miny, maxy),
        maxLng: Math.max(minx, maxx),
        maxLat: Math.max(miny, maxy),
      }
    }
    // Jika koordinat jutaan, kemungkinan besar sebenarnya EPSG:3857 Web Mercator
    cleanEpsg = '3857'
  }

  // Jika belum ada di cache proj4, ambil definisinya dari epsg.io
  if (!epsgCache[cleanEpsg]) {
    try {
      const epsgBase = (import.meta.env.VITE_EPSG_IO_URL || 'https://epsg.io').replace(/\/+$/, '')
      const res = await fetch(`${epsgBase}/${cleanEpsg}.proj4`)
      if (!res.ok) throw new Error(`EPSG:${cleanEpsg} not found on ${epsgBase}`)
      const def = await res.text()
      epsgCache[cleanEpsg] = def
      proj4.defs(`EPSG:${cleanEpsg}`, def)
    } catch (e) {
      console.warn(`Failed to fetch definition for EPSG:${cleanEpsg}:`, e)
      // Jika fetch gagal dan nilai masih dalam rentang derajat, gunakan fallback
      if (Math.abs(minx) <= 180 && Math.abs(miny) <= 90) {
        return {
          minLng: Math.min(minx, maxx),
          minLat: Math.min(miny, maxy),
          maxLng: Math.max(minx, maxx),
          maxLat: Math.max(miny, maxy),
        }
      }
      return null
    }
  } else {
    try {
      proj4.defs(`EPSG:${cleanEpsg}`, epsgCache[cleanEpsg])
    } catch {
      // already defined
    }
  }

  try {
    const [p1Lng, p1Lat] = proj4(`EPSG:${cleanEpsg}`, 'EPSG:4326', [minx, miny])
    const [p2Lng, p2Lat] = proj4(`EPSG:${cleanEpsg}`, 'EPSG:4326', [maxx, maxy])

    if ([p1Lng, p1Lat, p2Lng, p2Lat].some((v) => isNaN(v) || !isFinite(v))) {
      return null
    }

    const minLng = Math.min(p1Lng, p2Lng)
    const maxLng = Math.max(p1Lng, p2Lng)
    const minLat = Math.min(p1Lat, p2Lat)
    const maxLat = Math.max(p1Lat, p2Lat)

    // Validasi akhir derajat bumi
    if (minLat < -90 || maxLat > 90 || minLng < -180 || maxLng > 180) {
      console.warn('Re-projected coordinates out of bounds:', { minLng, minLat, maxLng, maxLat })
      return null
    }

    return { minLng, minLat, maxLng, maxLat }
  } catch (err) {
    console.error(`Error re-projecting EPSG:${cleanEpsg} to WGS84:`, err)
    return null
  }
}

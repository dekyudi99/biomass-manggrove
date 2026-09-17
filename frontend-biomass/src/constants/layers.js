export const BASE_LAYERS = {
  osm: {
    id: 'osm',
    name: 'Standar',
    url:
      import.meta.env.VITE_OSM_TILE_URL ||
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
    preview: 'https://tile.openstreetmap.org/4/13/8.png',
  },
  satellite: {
    id: 'satellite',
    name: 'Satelit',
    url:
      import.meta.env.VITE_SATELLITE_TILE_URL ||
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS',
    maxZoom: 19,
    preview: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/4/8/13',
  },
  terrain: {
    id: 'terrain',
    name: 'Medan',
    url:
      import.meta.env.VITE_TERRAIN_TILE_URL ||
      'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: 'Map data: &copy; OpenStreetMap, SRTM | Map style: &copy; OpenTopoMap',
    maxZoom: 17,
    preview: 'https://tile.opentopomap.org/4/13/8.png',
  },
}

const EARTH_RADIUS_METERS = 6378137
const SQUARE_METERS_PER_HECTARE = 10000

export const calculatePolygonAreaInHectares = (coordinates) => {
  if (!coordinates || coordinates.length < 3) return 0

  let area = 0
  for (let index = 0; index < coordinates.length; index += 1) {
    const nextIndex = (index + 1) % coordinates.length
    const [latitude, longitude] = coordinates[index]
    const [nextLatitude, nextLongitude] = coordinates[nextIndex]
    const latitudeRadians = (latitude * Math.PI) / 180
    const nextLatitudeRadians = (nextLatitude * Math.PI) / 180
    const longitudeDifferenceRadians = ((nextLongitude - longitude) * Math.PI) / 180

    area += longitudeDifferenceRadians * (
      2 + Math.sin(latitudeRadians) + Math.sin(nextLatitudeRadians)
    )
  }

  const areaInSquareMeters = Math.abs((area * EARTH_RADIUS_METERS ** 2) / 4)
  return areaInSquareMeters / SQUARE_METERS_PER_HECTARE
}

export const getCoordinatesBbox = (coordinates) => {
  if (!Array.isArray(coordinates) || coordinates.length === 0) return null

  const latitudes = coordinates.map(([latitude]) => latitude)
  const longitudes = coordinates.map(([, longitude]) => longitude)

  return [
    Math.min(...longitudes),
    Math.min(...latitudes),
    Math.max(...longitudes),
    Math.max(...latitudes),
  ]
}
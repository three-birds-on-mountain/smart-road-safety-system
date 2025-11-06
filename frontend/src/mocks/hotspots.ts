import type { AlertSettings } from '../types/settings';
import type { HotspotListResponse, NearbyHotspot } from '../types/hotspot';

interface MockParams {
  latitude: number;
  longitude: number;
  settings: AlertSettings;
}

const DEG_TO_RAD = Math.PI / 180;

const calculateDistance = (
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
) => {
  const lat1 = fromLat * DEG_TO_RAD;
  const lat2 = toLat * DEG_TO_RAD;
  const deltaLat = (toLat - fromLat) * DEG_TO_RAD;
  const deltaLng = (toLng - fromLng) * DEG_TO_RAD;

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6_371_000 * c;
};

const MOCK_HOTSPOTS: NearbyHotspot[] = [
  {
    id: 'mock-101',
    centerLatitude: 25.0418,
    centerLongitude: 121.546,
    radiusMeters: 220,
    totalAccidents: 12,
    a1Count: 2,
    a2Count: 6,
    a3Count: 4,
    earliestAccidentAt: '2024-02-10T08:30:00Z',
    latestAccidentAt: '2024-09-21T17:10:00Z',
    severityScore: 9.4,
    distanceFromUserMeters: 0,
  },
  {
    id: 'mock-102',
    centerLatitude: 25.0265,
    centerLongitude: 121.5293,
    radiusMeters: 180,
    totalAccidents: 7,
    a1Count: 1,
    a2Count: 3,
    a3Count: 3,
    earliestAccidentAt: '2024-04-02T11:40:00Z',
    latestAccidentAt: '2024-08-15T20:05:00Z',
    severityScore: 6.8,
    distanceFromUserMeters: 0,
  },
  {
    id: 'mock-103',
    centerLatitude: 25.0557,
    centerLongitude: 121.5601,
    radiusMeters: 260,
    totalAccidents: 18,
    a1Count: 3,
    a2Count: 9,
    a3Count: 6,
    earliestAccidentAt: '2024-01-22T05:15:00Z',
    latestAccidentAt: '2024-10-11T12:45:00Z',
    severityScore: 11.2,
    distanceFromUserMeters: 0,
  },
];

export const getMockNearbyHotspots = ({
  latitude,
  longitude,
  settings,
}: MockParams): HotspotListResponse<NearbyHotspot> => {
  const filtered = MOCK_HOTSPOTS.map((hotspot) => {
    const distance = calculateDistance(
      latitude,
      longitude,
      hotspot.centerLatitude,
      hotspot.centerLongitude,
    );
    return { ...hotspot, distanceFromUserMeters: Math.round(distance) };
  })
    .filter((hotspot) => hotspot.distanceFromUserMeters <= settings.distanceMeters)
    .filter((hotspot) => {
      const hasSeverity = (
        (hotspot.a1Count > 0 && settings.severityFilter.includes('A1')) ||
        (hotspot.a2Count > 0 && settings.severityFilter.includes('A2')) ||
        (hotspot.a3Count > 0 && settings.severityFilter.includes('A3'))
      );
      return hasSeverity;
    })
    .map((hotspot) => {
      const recentCutoff = settings.timeRange === '1Y'
        ? 365
        : settings.timeRange === '6M'
          ? 183
          : settings.timeRange === '3M'
            ? 92
            : 31;

      if (!hotspot.latestAccidentAt) {
        return hotspot;
      }

      const daysSinceLatest = Math.floor(
        (Date.now() - new Date(hotspot.latestAccidentAt).getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysSinceLatest <= recentCutoff) {
        return hotspot;
      }

      return hotspot;
    });

  return {
    data: filtered,
    meta: {
      totalCount: filtered.length,
      queryRadiusMeters: settings.distanceMeters,
      userLocation: {
        latitude,
        longitude,
      },
    },
  };
};

import type { AlertSettings } from '../types/settings';
import type {
  HotspotDetail,
  HotspotListResponse,
  HotspotSummary,
  NearbyHotspot,
} from '../types/hotspot';
import type { AccidentRecord } from '../types/accident';

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
    earliestAccidentAt: '2025-02-10T08:30:00Z',
    latestAccidentAt: '2025-09-21T17:10:00Z',
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
    earliestAccidentAt: '2025-04-02T11:40:00Z',
    latestAccidentAt: '2025-08-15T20:05:00Z',
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
    earliestAccidentAt: '2025-01-22T05:15:00Z',
    latestAccidentAt: '2025-10-11T12:45:00Z',
    severityScore: 11.2,
    distanceFromUserMeters: 0,
  },
  {
    id: 'mock-104',
    centerLatitude: 25.0332,
    centerLongitude: 121.5091,
    radiusMeters: 190,
    totalAccidents: 9,
    a1Count: 2,
    a2Count: 4,
    a3Count: 3,
    earliestAccidentAt: '2025-03-14T14:25:00Z',
    latestAccidentAt: '2025-10-05T09:40:00Z',
    severityScore: 8.6,
    distanceFromUserMeters: 0,
  },
  {
    id: 'mock-105',
    centerLatitude: 25.0628,
    centerLongitude: 121.5334,
    radiusMeters: 210,
    totalAccidents: 15,
    a1Count: 1,
    a2Count: 8,
    a3Count: 6,
    earliestAccidentAt: '2025-01-08T07:55:00Z',
    latestAccidentAt: '2025-09-28T19:20:00Z',
    severityScore: 10.7,
    distanceFromUserMeters: 0,
  },
  {
    id: 'mock-106',
    centerLatitude: 25.0297,
    centerLongitude: 121.5678,
    radiusMeters: 160,
    totalAccidents: 5,
    a1Count: 0,
    a2Count: 2,
    a3Count: 3,
    earliestAccidentAt: '2025-06-02T10:05:00Z',
    latestAccidentAt: '2025-09-17T22:15:00Z',
    severityScore: 5.1,
    distanceFromUserMeters: 0,
  },
  {
    id: 'mock-107',
    centerLatitude: 25.0795,
    centerLongitude: 121.5612,
    radiusMeters: 240,
    totalAccidents: 11,
    a1Count: 3,
    a2Count: 5,
    a3Count: 3,
    earliestAccidentAt: '2025-02-26T06:35:00Z',
    latestAccidentAt: '2025-10-08T16:45:00Z',
    severityScore: 9.9,
    distanceFromUserMeters: 0,
  },
  {
    id: 'mock-108',
    centerLatitude: 24.9987,
    centerLongitude: 121.5204,
    radiusMeters: 175,
    totalAccidents: 6,
    a1Count: 1,
    a2Count: 2,
    a3Count: 3,
    earliestAccidentAt: '2025-05-12T04:15:00Z',
    latestAccidentAt: '2025-09-29T13:05:00Z',
    severityScore: 6.2,
    distanceFromUserMeters: 0,
  },
];

const createAccident = (
  id: string,
  overrides: Partial<AccidentRecord> = {},
): AccidentRecord => ({
  id,
  latitude: overrides.latitude ?? 25.04,
  longitude: overrides.longitude ?? 121.56,
  occurredAt: overrides.occurredAt ?? new Date().toISOString(),
  severity: overrides.severity ?? 'A2',
  address: overrides.address ?? '臺北市信義區信義路四段 45 號',
  distanceMeters: overrides.distanceMeters ?? 85,
  involvedPeople: overrides.involvedPeople ?? ['騎士', '乘客'],
  involvedVehicles: overrides.involvedVehicles ?? ['機車'],
  description: overrides.description,
});

const MOCK_HOTSPOT_DETAILS: Record<string, HotspotDetail> = {
  'mock-101': {
    ...MOCK_HOTSPOTS[0],
    analysisPeriodStart: '2025-01-01T00:00:00Z',
    analysisPeriodEnd: '2025-10-11T23:59:59Z',
    accidents: [
      createAccident('mock-101-1', {
        occurredAt: '2025-09-21T17:10:00Z',
        severity: 'A2',
        address: '臺北市大安區忠孝東路四段 235 號',
        distanceMeters: 45,
        involvedVehicles: ['機車', '小客車'],
        involvedPeople: ['騎士', '駕駛'],
      }),
      createAccident('mock-101-2', {
        occurredAt: '2025-07-12T08:35:00Z',
        severity: 'A1',
        address: '臺北市大安區光復南路 120 號',
        distanceMeters: 110,
        involvedVehicles: ['行人', '貨車'],
        involvedPeople: ['行人', '駕駛'],
      }),
      createAccident('mock-101-3', {
        occurredAt: '2025-05-05T19:25:00Z',
        severity: 'A3',
        address: '臺北市大安區延吉街 22 巷口',
        distanceMeters: 62,
        involvedVehicles: ['機車'],
        involvedPeople: ['騎士'],
      }),
    ],
  },
  'mock-102': {
    ...MOCK_HOTSPOTS[1],
    analysisPeriodStart: '2025-03-01T00:00:00Z',
    analysisPeriodEnd: '2025-08-15T23:59:59Z',
    accidents: [
      createAccident('mock-102-1', {
        occurredAt: '2025-08-15T20:05:00Z',
        severity: 'A2',
        address: '臺北市中正區羅斯福路四段 68 號',
        distanceMeters: 95,
        involvedVehicles: ['公車', '機車'],
        involvedPeople: ['乘客', '騎士'],
      }),
      createAccident('mock-102-2', {
        occurredAt: '2025-06-21T11:40:00Z',
        severity: 'A3',
        address: '臺北市中正區汀州路三段 125 號',
        distanceMeters: 120,
        involvedVehicles: ['自行車', '小客車'],
        involvedPeople: ['單車騎士', '駕駛'],
      }),
    ],
  },
  'mock-103': {
    ...MOCK_HOTSPOTS[2],
    analysisPeriodStart: '2025-01-01T00:00:00Z',
    analysisPeriodEnd: '2025-10-11T23:59:59Z',
    accidents: [
      createAccident('mock-103-1', {
        occurredAt: '2025-10-11T12:45:00Z',
        severity: 'A1',
        address: '臺北市松山區南京東路五段 188 號',
        distanceMeters: 70,
        involvedVehicles: ['機車', '大貨車'],
        involvedPeople: ['騎士', '駕駛'],
      }),
      createAccident('mock-103-2', {
        occurredAt: '2025-08-08T22:10:00Z',
        severity: 'A2',
        address: '臺北市松山區民生東路五段 72 號',
        distanceMeters: 90,
        involvedVehicles: ['行人', '計程車'],
        involvedPeople: ['行人', '司機'],
      }),
      createAccident('mock-103-3', {
        occurredAt: '2025-03-18T14:05:00Z',
        severity: 'A3',
        address: '臺北市松山區光復北路 11 巷口',
        distanceMeters: 140,
        involvedVehicles: ['自行車', '機車'],
        involvedPeople: ['單車騎士', '騎士'],
      }),
    ],
  },
  'mock-104': {
    ...MOCK_HOTSPOTS[3],
    analysisPeriodStart: '2025-02-01T00:00:00Z',
    analysisPeriodEnd: '2025-10-05T23:59:59Z',
    accidents: [
      createAccident('mock-104-1', {
        occurredAt: '2025-10-05T09:40:00Z',
        severity: 'A2',
        address: '臺北市萬華區漢中街 121 號',
        distanceMeters: 60,
        involvedVehicles: ['小客車', '行人'],
        involvedPeople: ['駕駛', '行人'],
      }),
      createAccident('mock-104-2', {
        occurredAt: '2025-04-18T18:10:00Z',
        severity: 'A3',
        address: '臺北市萬華區康定路 35 號',
        distanceMeters: 105,
        involvedVehicles: ['機車'],
        involvedPeople: ['騎士'],
      }),
    ],
  },
  'mock-105': {
    ...MOCK_HOTSPOTS[4],
    analysisPeriodStart: '2025-01-01T00:00:00Z',
    analysisPeriodEnd: '2025-09-28T23:59:59Z',
    accidents: [
      createAccident('mock-105-1', {
        occurredAt: '2025-09-28T19:20:00Z',
        severity: 'A2',
        address: '臺北市中山區松江路 89 號',
        distanceMeters: 80,
        involvedVehicles: ['公車', '機車'],
        involvedPeople: ['乘客', '騎士'],
      }),
      createAccident('mock-105-2', {
        occurredAt: '2025-07-05T07:50:00Z',
        severity: 'A3',
        address: '臺北市中山區長春路 256 號',
        distanceMeters: 120,
        involvedVehicles: ['自行車', '貨車'],
        involvedPeople: ['單車騎士', '駕駛'],
      }),
      createAccident('mock-105-3', {
        occurredAt: '2025-02-11T23:15:00Z',
        severity: 'A1',
        address: '臺北市中山區南京東路二段 150 號',
        distanceMeters: 65,
        involvedVehicles: ['行人', '小客車'],
        involvedPeople: ['行人', '駕駛'],
      }),
    ],
  },
  'mock-106': {
    ...MOCK_HOTSPOTS[5],
    analysisPeriodStart: '2025-04-01T00:00:00Z',
    analysisPeriodEnd: '2025-09-17T23:59:59Z',
    accidents: [
      createAccident('mock-106-1', {
        occurredAt: '2025-09-17T22:15:00Z',
        severity: 'A3',
        address: '臺北市信義區松德路 100 號',
        distanceMeters: 55,
        involvedVehicles: ['機車'],
        involvedPeople: ['騎士'],
      }),
      createAccident('mock-106-2', {
        occurredAt: '2025-06-02T10:05:00Z',
        severity: 'A2',
        address: '臺北市信義區莊敬路 423 號',
        distanceMeters: 130,
        involvedVehicles: ['行人', '小客車'],
        involvedPeople: ['行人', '駕駛'],
      }),
    ],
  },
  'mock-107': {
    ...MOCK_HOTSPOTS[6],
    analysisPeriodStart: '2025-02-01T00:00:00Z',
    analysisPeriodEnd: '2025-10-08T23:59:59Z',
    accidents: [
      createAccident('mock-107-1', {
        occurredAt: '2025-10-08T16:45:00Z',
        severity: 'A1',
        address: '臺北市松山區八德路四段 678 號',
        distanceMeters: 75,
        involvedVehicles: ['大貨車', '機車'],
        involvedPeople: ['駕駛', '騎士'],
      }),
      createAccident('mock-107-2', {
        occurredAt: '2025-05-30T06:55:00Z',
        severity: 'A2',
        address: '臺北市松山區民權東路三段 210 號',
        distanceMeters: 95,
        involvedVehicles: ['行人', '機車'],
        involvedPeople: ['行人', '騎士'],
      }),
    ],
  },
  'mock-108': {
    ...MOCK_HOTSPOTS[7],
    analysisPeriodStart: '2025-05-01T00:00:00Z',
    analysisPeriodEnd: '2025-09-29T23:59:59Z',
    accidents: [
      createAccident('mock-108-1', {
        occurredAt: '2025-09-29T13:05:00Z',
        severity: 'A3',
        address: '新北市新店區北新路一段 12 號',
        distanceMeters: 150,
        involvedVehicles: ['機車'],
        involvedPeople: ['騎士'],
      }),
      createAccident('mock-108-2', {
        occurredAt: '2025-05-12T04:15:00Z',
        severity: 'A2',
        address: '新北市新店區中正路 352 號',
        distanceMeters: 210,
        involvedVehicles: ['自用車', '行人'],
        involvedPeople: ['駕駛', '行人'],
      }),
    ],
  },
};

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

export const getMockHotspotDetail = (hotspotId: string): HotspotDetail | undefined => {
  return MOCK_HOTSPOT_DETAILS[hotspotId];
};

export const getMockAllHotspots = (): HotspotListResponse<HotspotSummary> => {
  // 移除 distanceFromUserMeters，因為還不知道使用者位置
  const hotspots = MOCK_HOTSPOTS.map(({ distanceFromUserMeters, ...hotspot }) => hotspot);

  return {
    data: hotspots,
    meta: {
      totalCount: hotspots.length,
    },
  };
};

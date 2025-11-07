import type { AccidentRecord, AccidentSeverity } from './accident';

export interface HotspotSummary {
  id: string;
  centerLatitude: number;
  centerLongitude: number;
  radiusMeters: number;
  totalAccidents: number;
  a1Count: number;
  a2Count: number;
  a3Count: number;
  earliestAccidentAt?: string;
  latestAccidentAt?: string;
  severityScore?: number;
}

export interface NearbyHotspot extends HotspotSummary {
  distanceFromUserMeters: number;
}

export interface HotspotDetail extends HotspotSummary {
  distanceFromUserMeters?: number;
  analysisDate?: string;
  analysisPeriodStart?: string;
  analysisPeriodEnd?: string;
  accidents?: AccidentRecord[];
}

export interface HotspotListMeta {
  totalCount: number;
  queryRadiusMeters?: number;
  userLocation?: {
    latitude: number;
    longitude: number;
  };
  bounds?: {
    swLat: number;
    swLng: number;
    neLat: number;
    neLng: number;
  };
}

export interface HotspotListResponse<THotspot extends HotspotSummary = HotspotSummary> {
  data: THotspot[];
  meta: HotspotListMeta;
}

export const getHighestSeverityLevel = (hotspot: HotspotSummary): AccidentSeverity => {
  if (hotspot.a1Count > 0) {
    return 'A1';
  }
  if (hotspot.a2Count > 0) {
    return 'A2';
  }
  return 'A3';
};

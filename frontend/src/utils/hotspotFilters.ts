import type { HotspotSummary, NearbyHotspot } from '../types/hotspot';
import type { TimeRangeOption } from '../types/settings';
import type { AccidentSeverity } from '../types/accident';
import { calculateDistance, isInBounds } from './geolocation';

/**
 * 根據地圖邊界過濾熱點
 */
export function filterByMapBounds(
  hotspots: HotspotSummary[],
  bounds: {
    swLat: number;
    swLng: number;
    neLat: number;
    neLng: number;
  },
): HotspotSummary[] {
  return hotspots.filter((hotspot) =>
    isInBounds(hotspot.centerLatitude, hotspot.centerLongitude, bounds),
  );
}

/**
 * 根據使用者位置和距離過濾熱點
 */
export function filterByDistance(
  hotspots: HotspotSummary[],
  userLat: number,
  userLng: number,
  distanceMeters: number,
): NearbyHotspot[] {
  return hotspots
    .map((hotspot) => {
      const distance = calculateDistance(
        userLat,
        userLng,
        hotspot.centerLatitude,
        hotspot.centerLongitude,
      );

      return {
        ...hotspot,
        distanceFromUserMeters: distance,
      };
    })
    .filter((hotspot) => hotspot.distanceFromUserMeters <= distanceMeters)
    .sort((a, b) => a.distanceFromUserMeters - b.distanceFromUserMeters);
}

/**
 * 根據嚴重程度過濾熱點
 */
export function filterBySeverity(
  hotspots: HotspotSummary[],
  severityLevels: AccidentSeverity[],
): HotspotSummary[] {
  if (severityLevels.length === 0) {
    return hotspots;
  }

  return hotspots.filter((hotspot) => {
    const hasA1 = severityLevels.includes('A1') && hotspot.a1Count > 0;
    const hasA2 = severityLevels.includes('A2') && hotspot.a2Count > 0;
    const hasA3 = severityLevels.includes('A3') && hotspot.a3Count > 0;

    return hasA1 || hasA2 || hasA3;
  });
}

/**
 * 根據時間範圍過濾熱點
 */
export function filterByTimeRange(
  hotspots: HotspotSummary[],
  timeRange: TimeRangeOption,
): HotspotSummary[] {
  const now = new Date();
  let cutoffDate: Date;

  switch (timeRange) {
    case '1M':
      cutoffDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      break;
    case '3M':
      cutoffDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      break;
    case '6M':
      cutoffDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
      break;
    case '1Y':
      cutoffDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      break;
    default:
      return hotspots;
  }

  return hotspots.filter((hotspot) => {
    // 如果 latestAccidentAt 存在且在 cutoff date 之後，則保留
    if (hotspot.latestAccidentAt) {
      const latestDate = new Date(hotspot.latestAccidentAt);
      return latestDate >= cutoffDate;
    }
    return false;
  });
}

/**
 * 根據事故數量門檻過濾熱點
 * 只保留事故總數 >= threshold 的熱點
 */
export function filterByAccidentThreshold(
  hotspots: HotspotSummary[],
  threshold: number,
): HotspotSummary[] {
  if (threshold <= 1) {
    return hotspots;
  }

  return hotspots.filter((hotspot) => hotspot.totalAccidents >= threshold);
}

/**
 * 路線事故計算工具
 * 使用 Turf.js 計算路線附近的事故數量
 */

import buffer from '@turf/buffer';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { lineString, point } from '@turf/helpers';
import type { RouteGeometry } from '../types/route';
import type { HotspotSummary } from '../types/hotspot';
import type { RouteSafetySummary } from '../types/route';

/**
 * 計算路線經過的事故統計
 *
 * @param routeGeometry - 路線幾何（LineString，座標格式為 [lng, lat]）
 * @param hotspots - 已篩選的事故熱點列表（已經過時間、嚴重度、數量門檻篩選）
 * @param bufferDistance - 路線緩衝距離（公尺），預設 200
 * @returns 路線安全統計
 */
export function calculateRouteSafety(
  routeGeometry: RouteGeometry,
  hotspots: HotspotSummary[],
  bufferDistance: number = 200,
): RouteSafetySummary {
  // 1. 創建路線的 LineString 特徵
  const route = lineString(routeGeometry.coordinates);

  // 2. 創建路線的緩衝區（200 公尺）
  // Turf.js buffer 的距離單位預設是 kilometers，需轉換
  const bufferKm = bufferDistance / 1000;
  const routeBuffer = buffer(route, bufferKm, { units: 'kilometers' });

  if (!routeBuffer) {
    // Buffer 創建失敗，回傳空統計
    return {
      totalAccidents: 0,
      a1Count: 0,
      a2Count: 0,
      a3Count: 0,
      suggestPublicTransport: false,
      message: '安全出遊',
    };
  }

  // 3. 篩選路線附近的熱點
  let totalAccidents = 0;
  let a1Count = 0;
  let a2Count = 0;
  let a3Count = 0;

  for (const hotspot of hotspots) {
    // 創建熱點中心點
    const hotspotPoint = point([hotspot.centerLongitude, hotspot.centerLatitude]);

    // 檢查熱點是否在路線緩衝區內
    if (booleanPointInPolygon(hotspotPoint, routeBuffer)) {
      totalAccidents += hotspot.totalAccidents;
      a1Count += hotspot.a1Count;
      a2Count += hotspot.a2Count;
      a3Count += hotspot.a3Count;
    }
  }

  // 4. 判斷是否建議搭乘大眾交通工具（簡化版：總事故數 > 200）
  const suggestPublicTransport = totalAccidents > 200;
  const message = suggestPublicTransport ? '建議搭乘大眾交通工具' : '安全出遊';

  return {
    totalAccidents,
    a1Count,
    a2Count,
    a3Count,
    suggestPublicTransport,
    message,
  };
}

/**
 * 檢查熱點是否在路線附近
 *
 * @param hotspot - 熱點資料
 * @param routeGeometry - 路線幾何
 * @param bufferDistance - 緩衝距離（公尺）
 * @returns 是否在路線附近
 */
export function isHotspotNearRoute(
  hotspot: HotspotSummary,
  routeGeometry: RouteGeometry,
  bufferDistance: number = 200,
): boolean {
  const route = lineString(routeGeometry.coordinates);
  const bufferKm = bufferDistance / 1000;
  const routeBuffer = buffer(route, bufferKm, { units: 'kilometers' });

  if (!routeBuffer) {
    return false;
  }

  const hotspotPoint = point([hotspot.centerLongitude, hotspot.centerLatitude]);
  return booleanPointInPolygon(hotspotPoint, routeBuffer);
}

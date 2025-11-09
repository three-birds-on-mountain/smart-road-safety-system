/**
 * Mapbox API 客戶端
 * 包含 Geocoding（地址搜尋）和 Directions（路線規劃）
 */

import type { RouteGeometry } from '../types/route';
import { convertToTraditional } from '../utils/chineseConverter';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
const GEOCODING_API_BASE = 'https://api.mapbox.com/geocoding/v5/mapbox.places';
const DIRECTIONS_API_BASE = 'https://api.mapbox.com/directions/v5/mapbox';

// Geocoding API types
export interface GeocodingFeature {
  id: string;
  place_name: string; // 完整地址
  center: [number, number]; // [lng, lat]
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
}

export interface GeocodingResponse {
  features: GeocodingFeature[];
}

// Directions API types
export interface DirectionsRoute {
  geometry: RouteGeometry;
  distance: number; // 公尺
  duration: number; // 秒
}

export interface DirectionsResponse {
  routes: DirectionsRoute[];
  code: string; // 'Ok' or error code
}

/**
 * 地址搜尋（Geocoding API）
 *
 * @param query - 搜尋關鍵字（地址、地標或地點名稱）
 * @param options - 搜尋選項
 * @returns 搜尋結果
 */
export async function searchAddress(
  query: string,
  options: {
    limit?: number; // 最多回傳幾筆結果（預設 5）
    proximity?: [number, number]; // 優先搜尋附近位置 [lng, lat]
    bbox?: [number, number, number, number]; // 限制搜尋範圍 [minLng, minLat, maxLng, maxLat]
    types?: string[]; // 搜尋類型（預設包含 POI 和 address）
  } = {},
): Promise<GeocodingResponse> {
  const {
    limit = 5,
    proximity,
    bbox,
    types = ['poi', 'address', 'place'] // 預設搜尋地標、地址、地點
  } = options;

  const params = new URLSearchParams({
    access_token: MAPBOX_TOKEN,
    limit: limit.toString(),
    language: 'zh-TW', // 繁體中文結果
    country: 'TW', // 限制台灣地區
    autocomplete: 'true', // 啟用自動完成
    fuzzyMatch: 'true', // 啟用模糊匹配
  });

  // 指定搜尋類型（POI 地標、address 地址、place 城市等）
  if (types.length > 0) {
    params.append('types', types.join(','));
  }

  if (proximity) {
    params.append('proximity', proximity.join(','));
  }

  if (bbox) {
    params.append('bbox', bbox.join(','));
  }

  const url = `${GEOCODING_API_BASE}/${encodeURIComponent(query)}.json?${params}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Geocoding API error: ${response.status} ${response.statusText}`);
  }

  const data: GeocodingResponse = await response.json();

  // 將所有地址轉換為繁體中文
  data.features = data.features.map((feature) => ({
    ...feature,
    place_name: convertToTraditional(feature.place_name),
  }));

  return data;
}

/**
 * 路線規劃（Directions API）
 *
 * @param waypoints - 路線點位 [[lng, lat], [lng, lat], ...]
 * @param options - 路線規劃選項
 * @returns 路線資料
 */
export async function getDirections(
  waypoints: [number, number][],
  options: {
    profile?: 'driving-traffic' | 'driving' | 'walking' | 'cycling'; // 導航模式
    geometries?: 'geojson' | 'polyline' | 'polyline6'; // 幾何格式
    alternatives?: boolean; // 是否回傳替代路線
  } = {},
): Promise<DirectionsResponse> {
  const { profile = 'driving-traffic', geometries = 'geojson', alternatives = false } = options;

  // 組合路徑點：lng,lat;lng,lat
  const coordinates = waypoints.map((point) => point.join(',')).join(';');

  const params = new URLSearchParams({
    access_token: MAPBOX_TOKEN,
    geometries,
    alternatives: alternatives.toString(),
    overview: 'full', // 回傳完整路線幾何
    steps: 'false', // 不需要逐步導航指示
  });

  const url = `${DIRECTIONS_API_BASE}/${profile}/${coordinates}?${params}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Directions API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * 反向地理編碼（Reverse Geocoding）
 * 將經緯度轉換為地址
 *
 * @param lng - 經度
 * @param lat - 緯度
 * @returns 地址資訊
 */
export async function reverseGeocode(lng: number, lat: number): Promise<GeocodingResponse> {
  const params = new URLSearchParams({
    access_token: MAPBOX_TOKEN,
    language: 'zh-TW',
    limit: '1',
  });

  const url = `${GEOCODING_API_BASE}/${lng},${lat}.json?${params}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Reverse Geocoding API error: ${response.status} ${response.statusText}`);
  }

  const data: GeocodingResponse = await response.json();

  // 將所有地址轉換為繁體中文
  data.features = data.features.map((feature) => ({
    ...feature,
    place_name: convertToTraditional(feature.place_name),
  }));

  return data;
}

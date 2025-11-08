/**
 * 路線規劃相關類型定義
 */

export interface RoutePoint {
  address: string;
  lat: number;
  lng: number;
}

export interface RouteGeometry {
  type: 'LineString';
  coordinates: [number, number][]; // [lng, lat]
}

export interface Route {
  geometry: RouteGeometry;
  distance: number; // 公尺
  duration: number; // 秒
}

export interface RouteSafetySummary {
  totalAccidents: number;
  a1Count: number;
  a2Count: number;
  a3Count: number;
  suggestPublicTransport: boolean; // total > 200
  message: string; // "建議搭乘大眾交通工具" 或 "安全出遊"
}

export interface RouteState {
  origin: RoutePoint | null;
  destination: RoutePoint | null;
  route: Route | null;
  safetySummary: RouteSafetySummary | null;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

import { useEffect } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
import type { RouteGeometry } from '../../types/route';

export interface RouteLayerProps {
  /** Mapbox 地圖實例 */
  map: MapboxMap;
  /** 路線幾何資料 */
  routeGeometry: RouteGeometry | null;
}

/**
 * 路線圖層元件
 *
 * 在 Mapbox 地圖上繪製路線
 */
const RouteLayer = ({ map, routeGeometry }: RouteLayerProps) => {
  useEffect(() => {
    if (!map || !routeGeometry) {
      return;
    }

    const sourceId = 'route';
    const layerId = 'route-line';
    const layerCasingId = 'route-line-casing';

    // 檢查地圖樣式是否已載入
    const internalStyle = (map as MapboxMap & { style?: { _layers?: unknown } }).style;
    if (!map || typeof map.getStyle !== 'function' || !internalStyle) {
      return;
    }

    const style = map.getStyle();
    const hasStyleLayers = Boolean(style && Array.isArray(style.layers));
    if (!hasStyleLayers && !(internalStyle && internalStyle._layers)) {
      return;
    }

    // 創建 GeoJSON source
    const routeGeoJSON: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: routeGeometry,
        },
      ],
    };

    // 如果 source 已存在，更新資料
    const existingSource = map.getSource(sourceId);
    if (existingSource) {
      (existingSource as any).setData(routeGeoJSON);
    } else {
      // 新增 source
      map.addSource(sourceId, {
        type: 'geojson',
        data: routeGeoJSON,
      });
    }

    // 新增路線底層（白色邊框）
    if (!map.getLayer(layerCasingId)) {
      map.addLayer({
        id: layerCasingId,
        type: 'line',
        source: sourceId,
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#ffffff',
          'line-width': 8,
          'line-opacity': 0.8,
        },
      });
    }

    // 新增路線主體（藍色線）
    if (!map.getLayer(layerId)) {
      map.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#5AB4C5', // primary-500
          'line-width': 5,
          'line-opacity': 0.9,
        },
      });
    }

    // 調整地圖視角以顯示整條路線
    const coordinates = routeGeometry.coordinates;
    if (coordinates.length > 0) {
      // 計算邊界
      const bounds = coordinates.reduce(
        (bounds, coord) => {
          return [
            [Math.min(bounds[0][0], coord[0]), Math.min(bounds[0][1], coord[1])],
            [Math.max(bounds[1][0], coord[0]), Math.max(bounds[1][1], coord[1])],
          ] as [[number, number], [number, number]];
        },
        [
          [coordinates[0][0], coordinates[0][1]],
          [coordinates[0][0], coordinates[0][1]],
        ] as [[number, number], [number, number]],
      );

      map.fitBounds(bounds, {
        padding: { top: 100, bottom: 100, left: 50, right: 50 },
        duration: 1000,
      });
    }

    // 清理函式
    return () => {
      const mapInstance = map;
      const mapStyle = (mapInstance as MapboxMap & { style?: { _layers?: unknown } }).style;
      if (!mapInstance || typeof mapInstance.getStyle !== 'function' || !mapStyle) {
        return;
      }

      const style = mapInstance.getStyle();
      if (!style && !(mapStyle && mapStyle._layers)) {
        return;
      }

      // 移除圖層
      if (mapInstance.getLayer(layerId)) {
        mapInstance.removeLayer(layerId);
      }
      if (mapInstance.getLayer(layerCasingId)) {
        mapInstance.removeLayer(layerCasingId);
      }

      // 移除 source
      if (mapInstance.getSource(sourceId)) {
        mapInstance.removeSource(sourceId);
      }
    };
  }, [map, routeGeometry]);

  return null; // 本元件不渲染任何 React DOM 元素
};

export default RouteLayer;

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'

export interface UserLocationProps {
  /** Mapbox 地圖實例 */
  map: mapboxgl.Map
  /** 用戶緯度 */
  latitude: number | null
  /** 用戶經度 */
  longitude: number | null
  /** 是否自動置中地圖到用戶位置（預設：false） */
  autoCenter?: boolean
  /** 是否顯示精確度圓圈（預設：true） */
  showAccuracyCircle?: boolean
  /** GPS 精確度（公尺，預設：20） */
  accuracy?: number
}

/**
 * UserLocation 元件
 *
 * 在 Mapbox 地圖上顯示用戶當前位置標記。
 * 包含：
 * - 用戶位置標記（藍色圓點）
 * - 精確度圓圈（可選）
 * - 自動置中功能（可選）
 *
 * @example
 * ```tsx
 * <UserLocation
 *   map={mapInstance}
 *   latitude={userLat}
 *   longitude={userLng}
 *   autoCenter={true}
 * />
 * ```
 */
const UserLocation = ({
  map,
  latitude,
  longitude,
  autoCenter = false,
  showAccuracyCircle = true,
  accuracy = 20,
}: UserLocationProps) => {
  const markerRef = useRef<mapboxgl.Marker | null>(null)

  // 更新用戶位置標記
  useEffect(() => {
    if (!map || latitude == null || longitude == null) {
      // 移除現有標記
      if (markerRef.current) {
        markerRef.current.remove()
        markerRef.current = null
      }
      return
    }

    const coordinates: [number, number] = [longitude, latitude]

    // 如果標記不存在，建立新的標記
    if (!markerRef.current) {
      // 建立自訂標記元素（藍色圓點，使用 Design System 的 Primary 色）
      const el = document.createElement('div')
      el.style.width = '20px'
      el.style.height = '20px'
      el.style.borderRadius = '50%'
      el.style.backgroundColor = '#5AB4C5' // Primary-500
      el.style.border = '3px solid #ffffff'
      el.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.2)'
      el.style.cursor = 'pointer'

      // 建立標記實例
      const marker = new mapboxgl.Marker({
        element: el,
        anchor: 'center',
      })
        .setLngLat(coordinates)
        .addTo(map)

      markerRef.current = marker
    } else {
      // 更新現有標記的位置
      markerRef.current.setLngLat(coordinates)
    }

    // 自動置中地圖
    if (autoCenter) {
      map.easeTo({
        center: coordinates,
        zoom: Math.max(map.getZoom(), 13), // 至少 zoom 13
        duration: 1000,
      })
    }

    // 清理函式
    return () => {
      if (markerRef.current) {
        markerRef.current.remove()
        markerRef.current = null
      }
    }
  }, [map, latitude, longitude, autoCenter])

  // 更新精確度圓圈
  useEffect(() => {
    if (!map || typeof map.getStyle !== 'function') {
      return
    }

    if (!showAccuracyCircle || latitude == null || longitude == null) {
      // 移除精確度圓圈
      if (map.getLayer('user-location-accuracy')) {
        map.removeLayer('user-location-accuracy')
      }
      if (map.getSource('user-location-accuracy')) {
        map.removeSource('user-location-accuracy')
      }
      return
    }

    const sourceId = 'user-location-accuracy'
    const layerId = 'user-location-accuracy'

    // 建立精確度圓圈的 GeoJSON（使用 turf.js 的 circle 函式概念）
    const createAccuracyCircle = (
      lng: number,
      lat: number,
      radiusMeters: number
    ): GeoJSON.Feature<GeoJSON.Polygon> => {
      const points = 64 // 圓圈的平滑度
      const coordinates: [number, number][] = []

      for (let i = 0; i < points; i++) {
        const angle = (i * 360) / points
        const angleRad = (angle * Math.PI) / 180

        // 簡化的座標計算（假設地球為球體）
        const dx = radiusMeters * Math.cos(angleRad)
        const dy = radiusMeters * Math.sin(angleRad)

        const newLng = lng + (dx / (111320 * Math.cos((lat * Math.PI) / 180)))
        const newLat = lat + dy / 110540

        coordinates.push([newLng, newLat])
      }

      // 閉合多邊形
      coordinates.push(coordinates[0])

      return {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [coordinates],
        },
        properties: {},
      }
    }

    const circleFeature = createAccuracyCircle(longitude, latitude, accuracy)

    // 建立或更新 source
    const existingSource = map.getSource(sourceId)
    if (!existingSource) {
      map.addSource(sourceId, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [circleFeature],
        },
      })
    } else {
      const source = existingSource as mapboxgl.GeoJSONSource
      source.setData({
        type: 'FeatureCollection',
        features: [circleFeature],
      })
    }

    // 建立或更新圖層
    if (!map.getLayer(layerId)) {
      map.addLayer({
        id: layerId,
        type: 'fill',
        source: sourceId,
        paint: {
          'fill-color': '#5AB4C5', // Primary-500
          'fill-opacity': 0.15,
        },
      })

      // 加入邊框
      map.addLayer({
        id: `${layerId}-outline`,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': '#5AB4C5', // Primary-500
          'line-opacity': 0.4,
          'line-width': 2,
        },
      })
    }

    // 清理函式
    return () => {
      if (!map || typeof map.getStyle !== 'function') {
        return
      }

      // 檢查地圖樣式是否已載入
      const style = map.getStyle()
      if (!style) {
        return
      }

      if (map.getLayer(`${layerId}-outline`)) {
        map.removeLayer(`${layerId}-outline`)
      }
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId)
      }
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId)
      }
    }
  }, [map, latitude, longitude, showAccuracyCircle, accuracy])

  return null // 本元件不渲染任何 React DOM 元素
}

export default UserLocation

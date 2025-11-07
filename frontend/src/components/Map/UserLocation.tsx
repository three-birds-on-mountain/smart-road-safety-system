import { useCallback, useEffect, useRef } from 'react'
import type { GeoJSONSource, Map as MapboxMap, Marker as MapboxMarker } from 'mapbox-gl'
import { loadMapboxModule } from '../../lib/mapbox'

export interface UserLocationProps {
  /** Mapbox 地圖實例 */
  map: MapboxMap
  /** 用戶緯度 */
  latitude: number | null
  /** 用戶經度 */
  longitude: number | null
  /** 用戶朝向（角度） */
  heading?: number | null
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
  heading = null,
  autoCenter = false,
  showAccuracyCircle = true,
  accuracy = 20,
}: UserLocationProps) => {
  const markerRef = useRef<MapboxMarker | null>(null)
  const markerVisualRef = useRef<HTMLDivElement | null>(null)
  const arrowRef = useRef<HTMLDivElement | null>(null)
  const primaryColorRef = useRef('#5AB4C5')
  const mapboxLibRef = useRef<typeof import('mapbox-gl') | null>(null)

  const getMapbox = useCallback(async () => {
    if (!mapboxLibRef.current) {
      mapboxLibRef.current = await loadMapboxModule()
    }
    return mapboxLibRef.current
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    const resolved = getComputedStyle(document.documentElement)
      .getPropertyValue('--primary-500')
      .trim()
    if (resolved) {
      primaryColorRef.current = resolved
    }
  }, [])

  // 更新用戶位置標記
  useEffect(() => {
    let isMounted = true
    const internalMap = map as MapboxMap & { _removed?: boolean }
    if (!internalMap || internalMap._removed) {
      return
    }

    const syncLocation = async () => {
      if (latitude == null || longitude == null) {
        if (markerRef.current) {
          try {
            markerRef.current.remove()
          } catch (error) {
            console.warn('Failed to remove user location marker:', error)
          }
          markerRef.current = null
        }
        markerVisualRef.current = null
        arrowRef.current = null
        return
      }

      const module = await getMapbox()
      if (!isMounted) return

      const container = internalMap.getContainer?.()
      if (!container) {
        return
      }

      const coordinates: [number, number] = [longitude, latitude]

      if (!markerRef.current) {
        const el = document.createElement('div')
        el.style.width = '28px'
        el.style.height = '28px'
        el.style.display = 'flex'
        el.style.alignItems = 'center'
        el.style.justifyContent = 'center'
        el.style.pointerEvents = 'none'

        const visual = document.createElement('div')
        visual.style.position = 'relative'
        visual.style.width = '20px'
        visual.style.height = '20px'
        visual.style.display = 'flex'
        visual.style.alignItems = 'center'
        visual.style.justifyContent = 'center'
        visual.style.transition = 'transform 0.2s ease-out'

        const arrow = document.createElement('div')
        arrow.style.position = 'absolute'
        arrow.style.top = '-12px'
        arrow.style.left = '50%'
        arrow.style.width = '0'
        arrow.style.height = '0'
        arrow.style.borderLeft = '6px solid transparent'
        arrow.style.borderRight = '6px solid transparent'
        arrow.style.borderBottom = `10px solid ${primaryColorRef.current}`
        arrow.style.transform = 'translateX(-50%)'
        arrow.style.filter = 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.25))'
        arrow.style.display = 'none'

        const dot = document.createElement('div')
        dot.style.width = '18px'
        dot.style.height = '18px'
        dot.style.borderRadius = '50%'
        dot.style.backgroundColor = primaryColorRef.current
        dot.style.border = '3px solid #ffffff'
        dot.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.25)'

        visual.appendChild(arrow)
        visual.appendChild(dot)
        el.appendChild(visual)

        markerVisualRef.current = visual
        arrowRef.current = arrow

        try {
          const marker = new module.default.Marker({
            element: el,
            anchor: 'center',
          })
            .setLngLat(coordinates)
            .addTo(internalMap)

          markerRef.current = marker
        } catch (error) {
          console.error('Failed to add user location marker:', error)
          return
        }
      } else {
        markerRef.current.setLngLat(coordinates)
      }

      if (autoCenter) {
        internalMap.easeTo({
          center: coordinates,
          zoom: Math.max(internalMap.getZoom(), 13),
          duration: 1000,
        })
      }
    }

    void syncLocation()

    return () => {
      isMounted = false
      if (markerRef.current) {
        try {
          markerRef.current.remove()
        } catch (error) {
          console.warn('Failed to remove user location marker on cleanup:', error)
        }
        markerRef.current = null
      }
      markerVisualRef.current = null
      arrowRef.current = null
    }
  }, [map, latitude, longitude, autoCenter, getMapbox])

  const applyHeading = useCallback(() => {
    if (!markerVisualRef.current || !arrowRef.current) {
      return
    }

    if (heading == null || Number.isNaN(heading)) {
      arrowRef.current.style.display = 'none'
      markerVisualRef.current.style.transform = 'rotate(0deg)'
      return
    }

    arrowRef.current.style.display = 'block'
    const mapBearing = typeof map?.getBearing === 'function' ? map.getBearing() : 0
    const rotation = heading - mapBearing
    markerVisualRef.current.style.transform = `rotate(${rotation}deg)`
  }, [heading, map])

  useEffect(() => {
    applyHeading()
  }, [applyHeading])

  useEffect(() => {
    if (!map) {
      return
    }
    const handleMapChange = () => {
      applyHeading()
    }
    map.on('rotate', handleMapChange)
    map.on('pitch', handleMapChange)
    return () => {
      map.off('rotate', handleMapChange)
      map.off('pitch', handleMapChange)
    }
  }, [map, applyHeading])

  // 更新精確度圓圈
  useEffect(() => {
    const internalMap = map as MapboxMap & { _removed?: boolean }
    if (!internalMap || internalMap._removed || typeof internalMap.getStyle !== 'function') {
      return
    }

    if (!showAccuracyCircle || latitude == null || longitude == null) {
      // 移除精確度圓圈
      if (internalMap.getLayer('user-location-accuracy')) {
        internalMap.removeLayer('user-location-accuracy')
      }
      if (internalMap.getSource('user-location-accuracy')) {
        internalMap.removeSource('user-location-accuracy')
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
    const primaryColor = primaryColorRef.current
    try {
      const mapWithInternalStyle = internalMap as MapboxMap & {
        style?: {
          _layers?: unknown
          sources?: unknown
        }
      }

      const style = mapWithInternalStyle.getStyle()
      const hasSources = Boolean(style && (style.sources || mapWithInternalStyle.style?._layers))
      if (!hasSources) {
        return
      }

      const existingSource = internalMap.getSource(sourceId)
      if (!existingSource) {
        internalMap.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: [circleFeature],
          },
        })
      } else {
        const source = existingSource as GeoJSONSource
        source.setData({
          type: 'FeatureCollection',
          features: [circleFeature],
        })
      }

      // 建立或更新圖層
      if (!internalMap.getLayer(layerId)) {
        internalMap.addLayer({
          id: layerId,
          type: 'fill',
          source: sourceId,
          paint: {
            'fill-color': primaryColor,
            'fill-opacity': 0.15,
          },
        })

        // 加入邊框
        internalMap.addLayer({
          id: `${layerId}-outline`,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': primaryColor,
            'line-opacity': 0.4,
            'line-width': 2,
          },
        })
      }
    } catch (error) {
      console.error('Failed to render user accuracy circle:', error)
    }

    // 清理函式
    return () => {
      if (!internalMap || internalMap._removed || typeof internalMap.getStyle !== 'function') {
        return
      }

      try {
      const mapWithInternalStyle = internalMap as MapboxMap & {
          style?: {
            _layers?: unknown
            sources?: unknown
          }
        }

        if (mapWithInternalStyle.getLayer(`${layerId}-outline`)) {
          mapWithInternalStyle.removeLayer(`${layerId}-outline`)
        }
        if (mapWithInternalStyle.getLayer(layerId)) {
          mapWithInternalStyle.removeLayer(layerId)
        }
        if (mapWithInternalStyle.getSource(sourceId)) {
          mapWithInternalStyle.removeSource(sourceId)
        }
      } catch (error) {
        console.warn('Failed to remove user accuracy circle:', error)
      }
    }
  }, [map, latitude, longitude, showAccuracyCircle, accuracy])

  return null // 本元件不渲染任何 React DOM 元素
}

export default UserLocation

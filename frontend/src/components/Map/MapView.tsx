import { useEffect, useRef, useState } from 'react'
import 'mapbox-gl/dist/mapbox-gl.css'
import { loadMapboxModule } from '../../lib/mapbox'
import type { MapboxInstance } from '../../lib/mapbox'

// Mapbox Access Token （從環境變數載入）
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN

// 台灣中心座標（來自 research.md）
const TAIWAN_CENTER: [number, number] = [120.9605, 23.6978]
const DEFAULT_ZOOM = 7

export interface MapViewProps {
  /** 自訂樣式類別 */
  className?: string
  /** 地圖初始化完成的回調 */
  onMapLoad?: (map: MapboxInstance) => void
  /** 地圖移動結束的回調（用於載入新的熱點資料） */
  onMoveEnd?: (map: MapboxInstance) => void
  /** 地圖縮放結束的回調 */
  onZoomEnd?: (map: MapboxInstance) => void
  /** 初始中心點（預設為台灣中心） */
  center?: [number, number]
  /** 初始縮放層級 */
  zoom?: number
  children?: (map: MapboxInstance | null) => React.ReactNode
}

/**
 * MapView 元件
 *
 * 整合 Mapbox GL JS 的地圖視圖元件。負責：
 * - 初始化 Mapbox 地圖
 * - 監聽地圖事件（moveend, zoomend）
 * - 提供地圖實例給子元件使用
 *
 * @example
 * ```tsx
 * <MapView
 *   onMapLoad={(map) => console.log('地圖已載入')}
 *   onMoveEnd={(map) => {
 *     // 載入新的熱點資料
 *     const bounds = map.getBounds()
 *     fetchHotspotsInBounds(bounds)
 *   }}
 * >
 *   {(map) => map && (
 *     <>
 *       <HotspotLayer map={map} />
 *       <UserLocation map={map} />
 *     </>
 *   )}
 * </MapView>
 * ```
 */
const MapView = ({
  className = '',
  onMapLoad,
  onMoveEnd,
  onZoomEnd,
  center,
  zoom,
  children,
}: MapViewProps) => {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapboxInstance | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const initialCenterRef = useRef<[number, number]>(center ?? TAIWAN_CENTER)
  const initialZoomRef = useRef<number>(zoom ?? DEFAULT_ZOOM)

  // 初始化地圖
  useEffect(() => {
    let isMounted = true

    const mountMap = async () => {
      if (!mapContainerRef.current || mapRef.current) {
        return
      }

      if (!MAPBOX_TOKEN) {
        console.error(
          'Mapbox Access Token 未設定！請在 .env 檔案中設定 VITE_MAPBOX_ACCESS_TOKEN'
        )
        return
      }

      const module = await loadMapboxModule()
      if (!isMounted || !mapContainerRef.current) {
        return
      }

      const mapbox = module.default
      mapbox.accessToken = MAPBOX_TOKEN

      const map = new mapbox.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: initialCenterRef.current,
        zoom: initialZoomRef.current,
        attributionControl: true,
      })

      map.addControl(
        new mapbox.NavigationControl({
          showCompass: true,
          showZoom: true,
        }),
        'top-right'
      )

      map.on('load', () => {
        if (!isMounted) return
        setMapLoaded(true)
        onMapLoad?.(map)
      })

      if (onMoveEnd) {
        map.on('moveend', () => {
          onMoveEnd(map)
        })
      }

      if (onZoomEnd) {
        map.on('zoomend', () => {
          onZoomEnd(map)
        })
      }

      mapRef.current = map
    }

    void mountMap()

    return () => {
      isMounted = false
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
      setMapLoaded(false)
    }
  }, [onMapLoad, onMoveEnd, onZoomEnd])

  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !center) {
      return
    }

    mapRef.current.easeTo({
      center,
      duration: 600,
    })
  }, [center, mapLoaded])

  useEffect(() => {
    if (!mapRef.current || !mapLoaded || zoom == null) {
      return
    }

    mapRef.current.easeTo({
      zoom,
      duration: 400,
    })
  }, [zoom, mapLoaded])

  return (
    <div className={`relative ${className}`} data-testid="map-view">
      {/* 地圖容器 */}
      <div
        ref={mapContainerRef}
        className="absolute inset-0 rounded-lg"
        style={{ minHeight: '100%' }}
      />

      {/* 載入指示器 */}
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-muted">
          <div className="flex flex-col items-center gap-md">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
            <p className="text-sm text-text-secondary">地圖載入中...</p>
          </div>
        </div>
      )}

      {/* 子元件（例如 HotspotLayer, UserLocation） */}
      {mapLoaded && children?.(mapRef.current)}
    </div>
  )
}

export default MapView

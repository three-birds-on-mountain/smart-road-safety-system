import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

// Mapbox Access Token （從環境變數載入）
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN

// 台灣中心座標（來自 research.md）
const TAIWAN_CENTER: [number, number] = [120.9605, 23.6978]
const DEFAULT_ZOOM = 7

export interface MapViewProps {
  /** 自訂樣式類別 */
  className?: string
  /** 地圖初始化完成的回調 */
  onMapLoad?: (map: mapboxgl.Map) => void
  /** 地圖移動結束的回調（用於載入新的熱點資料） */
  onMoveEnd?: (map: mapboxgl.Map) => void
  /** 地圖縮放結束的回調 */
  onZoomEnd?: (map: mapboxgl.Map) => void
  /** 初始中心點（預設為台灣中心） */
  center?: [number, number]
  /** 初始縮放層級 */
  zoom?: number
  /** 子元件（例如 HotspotLayer, UserLocation） */
  children?: (map: mapboxgl.Map | null) => React.ReactNode
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
  center = TAIWAN_CENTER,
  zoom = DEFAULT_ZOOM,
  children,
}: MapViewProps) => {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)

  // 初始化地圖
  useEffect(() => {
    if (!mapContainerRef.current) return
    if (mapRef.current) return // 避免重複初始化

    // 檢查 Mapbox Token
    if (!MAPBOX_TOKEN) {
      console.error(
        'Mapbox Access Token 未設定！請在 .env 檔案中設定 VITE_MAPBOX_ACCESS_TOKEN'
      )
      return
    }

    // 設定 Mapbox Access Token
    mapboxgl.accessToken = MAPBOX_TOKEN

    // 初始化地圖實例
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12', // 使用街道地圖樣式
      center,
      zoom,
      attributionControl: true,
    })

    // 加入導航控制（縮放與旋轉按鈕）
    map.addControl(
      new mapboxgl.NavigationControl({
        showCompass: true,
        showZoom: true,
      }),
      'top-right'
    )

    // 加入全螢幕控制
    map.addControl(new mapboxgl.FullscreenControl(), 'top-right')

    // 地圖載入完成事件
    map.on('load', () => {
      console.log('Mapbox 地圖已載入')
      setMapLoaded(true)
      onMapLoad?.(map)
    })

    // 地圖移動結束事件（用於載入新的熱點資料）
    if (onMoveEnd) {
      map.on('moveend', () => {
        onMoveEnd(map)
      })
    }

    // 地圖縮放結束事件
    if (onZoomEnd) {
      map.on('zoomend', () => {
        onZoomEnd(map)
      })
    }

    mapRef.current = map

    // 清理函式：卸載元件時移除地圖
    return () => {
      map.remove()
      mapRef.current = null
      setMapLoaded(false)
    }
  }, [center, zoom, onMapLoad, onMoveEnd, onZoomEnd])

  return (
    <div className={`relative ${className}`}>
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

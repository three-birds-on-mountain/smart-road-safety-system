import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import type { HotspotSummary } from '../../types/hotspot'
import { getHighestSeverityLevel } from '../../types/hotspot'

// 確保 mapboxgl 被視為已使用（TypeScript 值引用）
void mapboxgl

export interface HotspotLayerProps {
  /** Mapbox 地圖實例 */
  map: mapboxgl.Map
  /** 熱點資料陣列 */
  hotspots: HotspotSummary[]
  /** 點擊熱點時的回調 */
  onHotspotClick?: (hotspot: HotspotSummary) => void
  /** 是否啟用聚合（預設：true） */
  enableClustering?: boolean
  /** 聚合最大縮放層級（超過此層級不再聚合，預設：14） */
  clusterMaxZoom?: number
  /** 聚合半徑（像素，預設：50） */
  clusterRadius?: number
}

/**
 * 將熱點資料轉換為 GeoJSON Feature Collection
 */
const createGeoJSON = (hotspots: HotspotSummary[]): GeoJSON.FeatureCollection => {
  return {
    type: 'FeatureCollection',
    features: hotspots.map((hotspot) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [hotspot.centerLongitude, hotspot.centerLatitude],
      },
      properties: {
        id: hotspot.id,
        radiusMeters: hotspot.radiusMeters,
        totalAccidents: hotspot.totalAccidents,
        a1Count: hotspot.a1Count,
        a2Count: hotspot.a2Count,
        a3Count: hotspot.a3Count,
        severity: getHighestSeverityLevel(hotspot),
        earliestAccidentAt: hotspot.earliestAccidentAt,
        latestAccidentAt: hotspot.latestAccidentAt,
      },
    })),
  }
}

/**
 * 根據事故嚴重程度返回顏色
 * 使用 Design System 的語意色彩
 * - A1（死亡）: Danger - #D45251（紅色）
 * - A2（重傷）: Warning - #FD853A（橙色）
 * - A3（輕傷）: Secondary - #F5BA4B（黃色）
 */
const getSeverityColor = (severity: string): string => {
  switch (severity) {
    case 'A1':
      return '#D45251' // Danger 色
    case 'A2':
      return '#FD853A' // Warning 色
    case 'A3':
      return '#F5BA4B' // Secondary 色
    default:
      return '#9CA3AF' // Grey 500
  }
}

/**
 * HotspotLayer 元件
 *
 * 在 Mapbox 地圖上渲染熱點資料，使用 Circle Layer 顯示。
 * 支援：
 * - 自動聚合（縮小時聚合、放大時展開）
 * - 顏色映射（根據事故嚴重程度：A1 紅色、A2 橙色、A3 黃色）
 * - 點擊互動（觸發 onHotspotClick 回調）
 *
 * @example
 * ```tsx
 * <HotspotLayer
 *   map={mapInstance}
 *   hotspots={hotspotsData}
 *   onHotspotClick={(hotspot) => console.log('點擊熱點', hotspot)}
 * />
 * ```
 */
const HotspotLayer = ({
  map,
  hotspots,
  onHotspotClick,
  enableClustering = true,
  clusterMaxZoom = 14,
  clusterRadius = 50,
}: HotspotLayerProps) => {
  const hotspotMapRef = useRef<Map<string, HotspotSummary>>(new Map())

  // 更新熱點資料與圖層
  useEffect(() => {
    if (!map) return

    const sourceId = 'hotspots'
    const clusterLayerId = 'hotspot-clusters'
    const clusterCountLayerId = 'hotspot-cluster-count'
    const unclusteredLayerId = 'hotspot-unclustered'

    // 建立熱點 ID -> 熱點資料的映射（用於點擊事件）
    hotspotMapRef.current.clear()
    hotspots.forEach((hotspot) => {
      hotspotMapRef.current.set(hotspot.id, hotspot)
    })

    // 如果 source 不存在，建立新的 source
    const existingSource = map.getSource(sourceId)
    if (!existingSource) {
      map.addSource(sourceId, {
        type: 'geojson',
        data: createGeoJSON(hotspots),
        cluster: enableClustering,
        clusterMaxZoom,
        clusterRadius,
      })
    } else {
      // 更新現有 source 的資料
      const source = existingSource as mapboxgl.GeoJSONSource
      source.setData(createGeoJSON(hotspots))
    }

    // === 圖層 1: 聚合圓圈 ===
    if (!map.getLayer(clusterLayerId) && enableClustering) {
      map.addLayer({
        id: clusterLayerId,
        type: 'circle',
        source: sourceId,
        filter: ['has', 'point_count'],
        paint: {
          // 根據聚合點數量調整顏色（漸層：藍 -> 黃 -> 紅）
          'circle-color': [
            'step',
            ['get', 'point_count'],
            '#5AB4C5', // Primary 色 (< 10)
            10,
            '#F5BA4B', // Secondary 色 (10-49)
            50,
            '#D45251', // Danger 色 (≥ 50)
          ],
          // 根據聚合點數量調整圓圈大小
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            20, // < 10
            10,
            25, // 10-49
            50,
            30, // ≥ 50
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff',
        },
      })
    }

    // === 圖層 2: 聚合點數量文字 ===
    if (!map.getLayer(clusterCountLayerId) && enableClustering) {
      map.addLayer({
        id: clusterCountLayerId,
        type: 'symbol',
        source: sourceId,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 14,
        },
        paint: {
          'text-color': '#ffffff',
        },
      })
    }

    // === 圖層 3: 個別熱點圓圈 ===
    if (!map.getLayer(unclusteredLayerId)) {
      map.addLayer({
        id: unclusteredLayerId,
        type: 'circle',
        source: sourceId,
        filter: enableClustering ? ['!', ['has', 'point_count']] : undefined,
        paint: {
          // 根據嚴重程度設定顏色
          'circle-color': [
            'match',
            ['get', 'severity'],
            'A1',
            getSeverityColor('A1'), // 紅色
            'A2',
            getSeverityColor('A2'), // 橙色
            'A3',
            getSeverityColor('A3'), // 黃色
            getSeverityColor(''), // 預設灰色
          ],
          'circle-radius': 10,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff',
          'circle-opacity': 0.85,
        },
      })
    }

    // 點擊聚合圓圈時，放大地圖
    const handleClusterClick = (e: mapboxgl.MapMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: [clusterLayerId],
      })

      if (!features.length) return

      const clusterId = features[0].properties?.cluster_id
      const source = map.getSource(sourceId) as mapboxgl.GeoJSONSource

      source.getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err || !features[0].geometry || features[0].geometry.type !== 'Point')
          return

        map.easeTo({
          center: features[0].geometry.coordinates as [number, number],
          zoom: zoom ?? map.getZoom() + 2,
        })
      })
    }

    // 點擊個別熱點時，觸發回調
    const handleHotspotClick = (e: mapboxgl.MapMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: [unclusteredLayerId],
      })

      if (!features.length || !onHotspotClick) return

      const hotspotId = features[0].properties?.id
      const hotspot = hotspotMapRef.current.get(hotspotId)

      if (hotspot) {
        onHotspotClick(hotspot)
      }
    }

    // 游標變更：懸停在熱點或聚合圓圈上時顯示 pointer
    const handleMouseEnter = () => {
      map.getCanvas().style.cursor = 'pointer'
    }

    const handleMouseLeave = () => {
      map.getCanvas().style.cursor = ''
    }

    // 註冊事件監聽器
    if (enableClustering) {
      map.on('click', clusterLayerId, handleClusterClick)
      map.on('mouseenter', clusterLayerId, handleMouseEnter)
      map.on('mouseenter', unclusteredLayerId, handleMouseEnter)
      map.on('mouseleave', clusterLayerId, handleMouseLeave)
      map.on('mouseleave', unclusteredLayerId, handleMouseLeave)
    }

    if (onHotspotClick) {
      map.on('click', unclusteredLayerId, handleHotspotClick)
    }

    // 清理函式：移除事件監聽器
    return () => {
      if (enableClustering) {
        map.off('click', clusterLayerId, handleClusterClick)
        map.off('mouseenter', clusterLayerId, handleMouseEnter)
        map.off('mouseenter', unclusteredLayerId, handleMouseEnter)
        map.off('mouseleave', clusterLayerId, handleMouseLeave)
        map.off('mouseleave', unclusteredLayerId, handleMouseLeave)
      }

      if (onHotspotClick) {
        map.off('click', unclusteredLayerId, handleHotspotClick)
      }
    }
  }, [
    map,
    hotspots,
    onHotspotClick,
    enableClustering,
    clusterMaxZoom,
    clusterRadius,
  ])

  // 清理圖層與 source（元件卸載時）
  useEffect(() => {
    return () => {
      const sourceId = 'hotspots'
      const layers = [
        'hotspot-clusters',
        'hotspot-cluster-count',
        'hotspot-unclustered',
      ]

      layers.forEach((layerId) => {
        if (map.getLayer(layerId)) {
          map.removeLayer(layerId)
        }
      })

      if (map.getSource(sourceId)) {
        map.removeSource(sourceId)
      }

      hotspotMapRef.current.clear()
    }
  }, [map])

  return null // 本元件不渲染任何 React DOM 元素
}

export default HotspotLayer

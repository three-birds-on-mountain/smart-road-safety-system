import { useEffect, useMemo, useRef } from 'react'
import type { GeoJSONSource, Map as MapboxMap, MapMouseEvent } from 'mapbox-gl'
import type { HotspotSummary } from '../../types/hotspot'
import { getHighestSeverityLevel } from '../../types/hotspot'

export interface HotspotLayerProps {
  /** Mapbox 地圖實例 */
  map: MapboxMap
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
const MAX_RENDERABLE_HOTSPOTS = 500

const pickHighPriorityHotspots = (hotspots: HotspotSummary[]): HotspotSummary[] => {
  if (hotspots.length <= MAX_RENDERABLE_HOTSPOTS) {
    return hotspots
  }

  const critical = hotspots.filter((hotspot) => hotspot.a1Count > 0)
  if (critical.length >= MAX_RENDERABLE_HOTSPOTS) {
    return critical.slice(0, MAX_RENDERABLE_HOTSPOTS)
  }

  const remainingSlots = MAX_RENDERABLE_HOTSPOTS - critical.length
  const sortedBySeverity = [...hotspots]
    .filter((hotspot) => hotspot.a1Count === 0)
    .sort((a, b) => b.totalAccidents - a.totalAccidents)

  return [...critical, ...sortedBySeverity.slice(0, remainingSlots)]
}

const HotspotLayer = ({
  map,
  hotspots,
  onHotspotClick,
  enableClustering = true,
  clusterMaxZoom = 14,
  clusterRadius = 50,
}: HotspotLayerProps) => {
  const hotspotMapRef = useRef<Map<string, HotspotSummary>>(new Map())
  const renderableHotspots = useMemo(() => {
    const result = pickHighPriorityHotspots(hotspots)
    return result
  }, [hotspots])

  // 更新熱點資料與圖層
  useEffect(() => {
    const internalStyle = (map as MapboxMap & { style?: { _layers?: unknown } }).style
    if (!map || typeof map.getStyle !== 'function' || !internalStyle) {
      return
    }

    const style = map.getStyle()
    const hasStyleLayers = Boolean(style && Array.isArray(style.layers))
    if (!hasStyleLayers && !(internalStyle && internalStyle._layers)) {
      return
    }

    const sourceId = 'hotspots'
    const clusterLayerId = 'hotspot-clusters'
    const clusterCountLayerId = 'hotspot-cluster-count'
    const unclusteredLayerId = 'hotspot-unclustered'
    const unclusteredRippleLayerId = 'hotspot-unclustered-ripple'
    const unclusteredLabelLayerId = 'hotspot-unclustered-label'

    // 建立熱點 ID -> 熱點資料的映射（用於點擊事件）
    hotspotMapRef.current.clear()
    renderableHotspots.forEach((hotspot) => {
      hotspotMapRef.current.set(hotspot.id, hotspot)
    })

    // 如果 source 不存在，建立新的 source
    const existingSource = map.getSource(sourceId)
    if (!existingSource) {
      map.addSource(sourceId, {
        type: 'geojson',
        data: createGeoJSON(renderableHotspots),
        cluster: enableClustering,
        clusterMaxZoom,
        clusterRadius,
      })
    } else {
      // 更新現有 source 的資料
      const source = existingSource as GeoJSONSource
      source.setData(createGeoJSON(renderableHotspots))
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

    if (!map.getLayer(unclusteredRippleLayerId)) {
      map.addLayer(
        {
          id: unclusteredRippleLayerId,
          type: 'circle',
          source: sourceId,
          filter: enableClustering ? ['!', ['has', 'point_count']] : undefined,
          paint: {
            'circle-color': [
              'match',
              ['get', 'severity'],
              'A1',
              'rgba(212,82,81,0.6)',
              'A2',
              'rgba(253,133,58,0.55)',
              'A3',
              'rgba(245,186,75,0.55)',
              'rgba(156,163,175,0.45)',
            ],
            'circle-radius': 12,
            'circle-opacity': 0.5,
            'circle-stroke-width': 1.4,
            'circle-stroke-color': [
              'match',
              ['get', 'severity'],
              'A1',
              '#D45251',
              'A2',
              '#FD853A',
              'A3',
              '#F5BA4B',
              '#9CA3AF',
            ],
            'circle-stroke-opacity': 0.9,
            'circle-blur': 0.2,
          },
        },
        unclusteredLayerId,
      )
    }

    if (!map.getLayer(unclusteredLabelLayerId)) {
      map.addLayer({
        id: unclusteredLabelLayerId,
        type: 'symbol',
        source: sourceId,
        filter: enableClustering ? ['!', ['has', 'point_count']] : undefined,
        layout: {
          'text-field': ['to-string', ['get', 'totalAccidents']],
          'text-size': 11,
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-offset': [0, 0],
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#FFFFFF',
        },
      })
    }

    // 點擊聚合圓圈時，放大地圖
    const handleClusterClick = (e: MapMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: [clusterLayerId],
      })

      if (!features.length) return

      const clusterId = features[0].properties?.cluster_id
      const source = map.getSource(sourceId) as GeoJSONSource

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
    const handleHotspotClick = (e: MapMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: [unclusteredLayerId, unclusteredRippleLayerId, unclusteredLabelLayerId],
      })

      if (!features.length || !onHotspotClick) return

      const hotspotId = features[0].properties?.id
      const hotspot = hotspotMapRef.current.get(hotspotId)

      if (hotspot) {
        if (features[0].geometry.type === 'Point') {
          map.easeTo({
            center: features[0].geometry.coordinates as [number, number],
            zoom: Math.max(map.getZoom(), 15),
            duration: 400,
          })
        }
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
    if (enableClustering && map.getLayer(clusterLayerId)) {
      map.on('click', clusterLayerId, handleClusterClick)
      map.on('mouseenter', clusterLayerId, handleMouseEnter)
      map.on('mouseenter', unclusteredLayerId, handleMouseEnter)
      map.on('mouseenter', unclusteredRippleLayerId, handleMouseEnter)
      map.on('mouseenter', unclusteredLabelLayerId, handleMouseEnter)
      map.on('mouseleave', clusterLayerId, handleMouseLeave)
      map.on('mouseleave', unclusteredLayerId, handleMouseLeave)
      map.on('mouseleave', unclusteredRippleLayerId, handleMouseLeave)
      map.on('mouseleave', unclusteredLabelLayerId, handleMouseLeave)
    }

    if (onHotspotClick) {
      map.on('click', unclusteredLayerId, handleHotspotClick)
      map.on('click', unclusteredRippleLayerId, handleHotspotClick)
      map.on('click', unclusteredLabelLayerId, handleHotspotClick)
    }

    let animationFrame = 0
    const cycleMs = 2200
    const baseRadius = 10
    const grow = 46
    let startTs = 0
    let prevProgress = 0
    const ease = (t: number) => t ** 1.4

    const animateRipple = (ts: number) => {
      if (!map.getLayer(unclusteredRippleLayerId)) {
        return
      }
      if (!startTs) startTs = ts

      const elapsed = ts - startTs
      const progress = (elapsed % cycleMs) / cycleMs
      const wrapped = progress < prevProgress

      if (wrapped) {
        map.setPaintProperty(unclusteredRippleLayerId, 'circle-opacity', 0)
        map.setPaintProperty(unclusteredRippleLayerId, 'circle-radius', baseRadius)
        prevProgress = progress
        animationFrame = requestAnimationFrame(animateRipple)
        return
      }

      const eased = ease(progress)
      const radius = baseRadius + eased * grow
      const fadeOut = Math.max(0, 1 - progress)
      const fadeInWindow = 0.08
      const fadeIn = progress < fadeInWindow ? progress / fadeInWindow : 1

      const opacity = 0.6 * fadeOut * fadeIn
      const strokeOpacity = 0.9 * Math.max(0, 1 - eased * 0.9)
      const blur = 0.3 + eased * 1.2

      map.setPaintProperty(unclusteredRippleLayerId, 'circle-radius', radius)
      map.setPaintProperty(unclusteredRippleLayerId, 'circle-opacity', opacity)
      map.setPaintProperty(unclusteredRippleLayerId, 'circle-stroke-opacity', strokeOpacity)
      map.setPaintProperty(unclusteredRippleLayerId, 'circle-blur', blur)

      prevProgress = progress
      animationFrame = requestAnimationFrame(animateRipple)
    }

    if (map.getLayer(unclusteredRippleLayerId)) {
      animationFrame = requestAnimationFrame(animateRipple)
    }

    // 清理函式：移除事件監聽器
    return () => {
      const internalStyle = (map as MapboxMap & { style?: { _layers?: unknown } }).style
      if (!map || typeof map.getStyle !== 'function' || !internalStyle) {
        return
      }

      if (enableClustering && map.getLayer(clusterLayerId)) {
        map.off('click', clusterLayerId, handleClusterClick)
        map.off('mouseenter', clusterLayerId, handleMouseEnter)
        map.off('mouseenter', unclusteredLayerId, handleMouseEnter)
        map.off('mouseenter', unclusteredRippleLayerId, handleMouseEnter)
        map.off('mouseenter', unclusteredLabelLayerId, handleMouseEnter)
        map.off('mouseleave', clusterLayerId, handleMouseLeave)
        map.off('mouseleave', unclusteredLayerId, handleMouseLeave)
        map.off('mouseleave', unclusteredRippleLayerId, handleMouseLeave)
        map.off('mouseleave', unclusteredLabelLayerId, handleMouseLeave)
      }

      if (onHotspotClick && map.getLayer(unclusteredLayerId)) {
        map.off('click', unclusteredLayerId, handleHotspotClick)
      }
      if (onHotspotClick && map.getLayer(unclusteredRippleLayerId)) {
        map.off('click', unclusteredRippleLayerId, handleHotspotClick)
      }
      if (onHotspotClick && map.getLayer(unclusteredLabelLayerId)) {
        map.off('click', unclusteredLabelLayerId, handleHotspotClick)
      }

      if (animationFrame) {
        cancelAnimationFrame(animationFrame)
      }
    }
  }, [
    map,
    renderableHotspots,
    onHotspotClick,
    enableClustering,
    clusterMaxZoom,
    clusterRadius,
  ])

  // 清理圖層與 source（元件卸載時）
  useEffect(() => {
    const mapInstance = map
    const hotspotRegistry = hotspotMapRef.current

    return () => {
      const sourceId = 'hotspots'
      const mapStyle = (mapInstance as MapboxMap & { style?: { _layers?: unknown } }).style
      if (!mapInstance || typeof mapInstance.getStyle !== 'function' || !mapStyle) {
        return
      }

      const style = mapInstance.getStyle()
      if (!style && !(mapStyle && mapStyle._layers)) {
        hotspotRegistry.clear()
        return
      }
      const layers = [
        'hotspot-clusters',
        'hotspot-cluster-count',
        'hotspot-unclustered',
        'hotspot-unclustered-ripple',
        'hotspot-unclustered-label',
      ]

      layers.forEach((layerId) => {
        if (mapInstance.getLayer(layerId)) {
          mapInstance.removeLayer(layerId)
        }
      })

      if (mapInstance.getSource(sourceId)) {
        mapInstance.removeSource(sourceId)
      }

      hotspotRegistry.clear()
    }
  }, [map])

  return null // 本元件不渲染任何 React DOM 元素
}

export default HotspotLayer

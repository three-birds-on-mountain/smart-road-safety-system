import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AlertOverlay from '../components/Alert/AlertOverlay'
import MapView from '../components/Map/MapView'
import HotspotLayer from '../components/Map/HotspotLayer'
import UserLocation from '../components/Map/UserLocation'
import HotspotDetailPopup from '../components/Map/HotspotDetailPopup'
import { useAppDispatch, useAppSelector } from '../hooks/store'
import { createAlertService, type TriggerAlertResult } from '../services/alerts'
import { createGeolocationService } from '../services/geolocation'
import { fetchNearbyHotspots } from '../store/hotspotsSlice'
import { toggleIgnoredHotspot } from '../store/settingsSlice'
import type { NearbyHotspot, HotspotSummary } from '../types/hotspot'
import type { AlertChannel } from '../types/settings'

interface ActiveAlertState {
  hotspot: NearbyHotspot
  distanceMeters: number
  muted: boolean
  channels: AlertChannel[]
  unsupportedChannels: AlertChannel[]
  reason?: TriggerAlertResult['reason']
}

const gpsStatusDescriptor = {
  idle: { label: '等待定位', className: 'bg-gray-50 text-text-secondary' },
  locating: {
    label: '定位中',
    className: 'bg-secondary-50 text-secondary-700',
  },
  active: {
    label: '定位正常',
    className: 'bg-success-500 text-white',
  },
  error: { label: '定位失敗', className: 'bg-danger-500 text-white' },
  unsupported: {
    label: '裝置不支援定位',
    className: 'bg-danger-500 text-white',
  },
} as const

const MapPage = () => {
  const dispatch = useAppDispatch()
  const locationState = useAppSelector((state) => state.location)
  const settings = useAppSelector((state) => state.settings.current)
  const hotspotsState = useAppSelector((state) => state.hotspots)
  const currentLocation = locationState.current
  const latitude = currentLocation?.latitude
  const longitude = currentLocation?.longitude

  const [activeAlert, setActiveAlert] = useState<ActiveAlertState | null>(null)
  const [selectedHotspot, setSelectedHotspot] = useState<HotspotSummary | null>(
    null,
  )

  const activeAlertRef = useRef<ActiveAlertState | null>(null)
  const geolocationServiceRef = useRef<ReturnType<
    typeof createGeolocationService
  > | null>(null)
  const alertServiceRef = useRef<ReturnType<typeof createAlertService> | null>(
    null,
  )
  const fetchControllerRef = useRef<AbortController | null>(null)

  const fetchDependencies = useMemo(() => {
    if (latitude == null || longitude == null) {
      return null
    }
    return {
      latitude,
      longitude,
      distance: settings.distanceMeters,
      severity: settings.severityFilter.join(','),
      timeRange: settings.timeRange,
    }
  }, [
    latitude,
    longitude,
    settings.distanceMeters,
    settings.severityFilter,
    settings.timeRange,
  ])

  const updateActiveAlert = useCallback((next: ActiveAlertState | null) => {
    activeAlertRef.current = next
    setActiveAlert(next)
  }, [])

  useEffect(() => {
    const service = createGeolocationService(dispatch)
    geolocationServiceRef.current = service

    service.startWatching({
      onError: () => {
        // no-op: slice already handles error state
      },
    })

    return () => {
      service.reset()
      geolocationServiceRef.current = null
    }
  }, [dispatch])

  useEffect(() => {
    const previousService = alertServiceRef.current
    previousService?.stop()

    const service = createAlertService({
      minIntervalMs: Math.max(settings.autoSilenceSeconds * 1000, 30_000),
    })
    alertServiceRef.current = service

    return () => {
      service.stop()
      if (alertServiceRef.current === service) {
        alertServiceRef.current = null
      }
    }
  }, [settings.autoSilenceSeconds])

  useEffect(() => {
    if (!fetchDependencies || locationState.status !== 'active') {
      fetchControllerRef.current?.abort()
      fetchControllerRef.current = null
      return
    }

    const controller = new AbortController()
    fetchControllerRef.current?.abort()
    fetchControllerRef.current = controller

    dispatch(
      fetchNearbyHotspots({
        latitude: fetchDependencies.latitude,
        longitude: fetchDependencies.longitude,
        signal: controller.signal,
      }),
    )

    return () => {
      controller.abort()
    }
  }, [dispatch, fetchDependencies, locationState.status])

  useEffect(() => {
    const alertService = alertServiceRef.current
    const currentLocation = locationState.current

    if (!alertService || !currentLocation) {
      if (activeAlertRef.current) {
        alertService?.silence()
        updateActiveAlert(null)
      }
      return
    }

    const nearby = hotspotsState.nearby

    if (!nearby.length) {
      if (activeAlertRef.current) {
        alertService.silence()
        updateActiveAlert(null)
      }
      return
    }

    let triggered: ActiveAlertState | null = null
    const previous = activeAlertRef.current

    for (const hotspot of nearby) {
      const result = alertService.triggerAlert({
        hotspot,
        userLocation: currentLocation,
        settings,
      })

      if (result.triggered) {
        const muted =
          result.activatedChannels.length === 0 ||
          result.reason === 'channels-disabled' ||
          result.reason === 'unsupported'

        triggered = {
          hotspot,
          distanceMeters: result.distanceMeters,
          muted,
          channels: result.activatedChannels,
          unsupportedChannels: result.unsupportedChannels ?? [],
          reason: result.reason,
        }
        break
      }

      if (result.reason === 'cooldown' && previous?.hotspot.id === hotspot.id) {
        triggered = {
          hotspot: previous.hotspot,
          distanceMeters: result.distanceMeters,
          muted: previous.muted,
          channels: previous.channels,
          unsupportedChannels: previous.unsupportedChannels,
          reason: result.reason,
        }
        break
      }
    }

    if (triggered) {
      const prev = activeAlertRef.current
      const isSameHotspot = prev?.hotspot.id === triggered.hotspot.id
      const sameChannels =
        prev &&
        prev.channels.length === triggered.channels.length &&
        prev.channels.every((channel, index) => channel === triggered.channels[index])
      const sameUnsupported =
        prev &&
        prev.unsupportedChannels.length === triggered.unsupportedChannels.length &&
        prev.unsupportedChannels.every(
          (channel, index) => channel === triggered.unsupportedChannels[index],
        )
      const hasChanges =
        !isSameHotspot ||
        Math.round(prev?.distanceMeters ?? -1) !==
          Math.round(triggered.distanceMeters) ||
        prev?.muted !== triggered.muted ||
        !sameChannels ||
        !sameUnsupported ||
        prev?.reason !== triggered.reason

      if (hasChanges) {
        updateActiveAlert(triggered)
      }
      return
    }

    if (activeAlertRef.current) {
      alertService.silence()
      updateActiveAlert(null)
    }
  }, [hotspotsState, locationState, settings, updateActiveAlert])

  const handleDismissAlert = () => {
    alertServiceRef.current?.silence()
    updateActiveAlert(null)
  }

  const handleIgnoreHotspot = (hotspotId: string) => {
    dispatch(toggleIgnoredHotspot(hotspotId))
    alertServiceRef.current?.clearHotspotCooldown(hotspotId)
    alertServiceRef.current?.silence()
    updateActiveAlert(null)
  }

  const gpsDescriptor =
    gpsStatusDescriptor[locationState.status] ?? gpsStatusDescriptor.idle

  return (
    <section className="flex flex-1 flex-col gap-lg">
      <header className="flex flex-col gap-sm">
        <h1 className="text-3xl font-semibold text-primary-700">
          即時危險區域警示
        </h1>
        <p className="max-w-2xl text-base text-text-secondary">
          持續監測您的 GPS 位置，當進入高風險熱點時即時觸發警示。地圖顯示事故熱點分布與您的當前位置。
        </p>
      </header>

      <div className="flex flex-1 flex-col gap-md rounded-lg bg-surface-white p-lg shadow-md">
        <div className="flex flex-wrap items-center gap-sm text-sm">
          <span
            className={[
              'rounded-full px-sm py-xs font-semibold',
              gpsDescriptor.className,
            ].join(' ')}
          >
            {gpsDescriptor.label}
          </span>
          <span className="rounded-full bg-primary-50 px-sm py-xs text-primary-700">
            提醒距離：{settings.distanceMeters} 公尺
          </span>
          <span className="rounded-full bg-secondary-50 px-sm py-xs text-secondary-700">
            事故等級：{settings.severityFilter.join(' / ')}
          </span>
          <span className="rounded-full bg-gray-50 px-sm py-xs text-text-secondary">
            時間範圍：{settings.timeRange}
          </span>
        </div>

        {locationState.error && (
          <p className="rounded-md border border-danger-500 bg-danger-500/10 px-md py-sm text-sm text-danger-500">
            {locationState.error}
          </p>
        )}

        <div className="relative mt-sm h-[500px] overflow-hidden rounded-lg border border-gray-100">
          <MapView
            className="h-full w-full"
            center={
              latitude && longitude ? [longitude, latitude] : undefined
            }
            zoom={13}
          >
            {(map) =>
              map && (
                <>
                  <HotspotLayer
                    map={map}
                    hotspots={hotspotsState.nearby}
                    onHotspotClick={setSelectedHotspot}
                    enableClustering={true}
                  />
                  <UserLocation
                    map={map}
                    latitude={latitude ?? null}
                    longitude={longitude ?? null}
                    showAccuracyCircle={true}
                  />
                </>
              )
            }
          </MapView>

          {/* 警示覆蓋層（置於地圖上方） */}
          {activeAlert && (
            <div className="pointer-events-auto absolute left-1/2 top-4 w-full max-w-[90%] -translate-x-1/2 md:left-4 md:right-auto md:top-4 md:max-w-sm md:translate-x-0">
              <AlertOverlay
                hotspot={activeAlert.hotspot}
                distanceMeters={activeAlert.distanceMeters}
                isMuted={activeAlert.muted}
                channels={activeAlert.channels}
                unsupportedChannels={activeAlert.unsupportedChannels}
                reason={activeAlert.reason}
                onDismiss={handleDismissAlert}
                onIgnore={handleIgnoreHotspot}
              />
            </div>
          )}

          {/* 熱點詳情彈窗（置於地圖上方） */}
          {selectedHotspot && (
            <div className="pointer-events-auto absolute right-4 top-4 max-w-sm">
              <HotspotDetailPopup
                hotspot={selectedHotspot}
                onClose={() => setSelectedHotspot(null)}
              />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-sm text-sm text-text-secondary">
          {hotspotsState.status === 'loading' && (
            <span className="rounded-md bg-primary-50 px-sm py-xs text-primary-700">
              取得附近熱點中…
            </span>
          )}
          {hotspotsState.status === 'failed' && hotspotsState.error && (
            <span className="rounded-md bg-danger-500/10 px-sm py-xs text-danger-500">
              熱點資料載入失敗：{hotspotsState.error}
            </span>
          )}
          {hotspotsState.nearbyMeta?.totalCount !== undefined && (
            <span className="rounded-md bg-secondary-50 px-sm py-xs text-secondary-700">
              近距離熱點數：{hotspotsState.nearbyMeta.totalCount}
            </span>
          )}
        </div>

        <p className="text-xs text-text-description">
          地圖整合已完成！點擊地圖上的熱點標記可查看詳細資訊。地圖會自動追蹤您的 GPS 位置並顯示附近的事故熱點。
        </p>
      </div>
    </section>
  )
}

export default MapPage

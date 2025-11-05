import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import AlertOverlay from '../components/Alert/AlertOverlay'
import { useAppDispatch, useAppSelector } from '../hooks/store'
import { createAlertService } from '../services/alerts'
import { createGeolocationService } from '../services/geolocation'
import {
  fetchNearbyHotspots,
  type FetchNearbyParams,
} from '../store/hotspotsSlice'
import { toggleIgnoredHotspot } from '../store/settingsSlice'
import type { NearbyHotspot } from '../types/hotspot'
import type { TimeRangeOption } from '../types/settings'

const timeRangeQuery: Record<TimeRangeOption, string> = {
  '1Y': '12_months',
  '6M': '6_months',
  '3M': '3_months',
  '1M': '1_month',
}

interface ActiveAlertState {
  hotspot: NearbyHotspot
  distanceMeters: number
  muted: boolean
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

  const [activeAlert, setActiveAlert] = useState<ActiveAlertState | null>(null)

  const activeAlertRef = useRef<ActiveAlertState | null>(null)
  const geolocationServiceRef = useRef<ReturnType<
    typeof createGeolocationService
  > | null>(null)
  const alertServiceRef = useRef<ReturnType<typeof createAlertService> | null>(
    null,
  )
  const fetchControllerRef = useRef<AbortController | null>(null)

  const requestParams: Omit<FetchNearbyParams, 'signal'> | null = useMemo(() => {
    if (!locationState.current) {
      return null
    }
    return {
      latitude: locationState.current.latitude,
      longitude: locationState.current.longitude,
      distanceMeters: settings.distanceMeters,
      severityLevels: settings.severityFilter,
      timeRange: timeRangeQuery[settings.timeRange],
    }
  }, [locationState, settings])

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
    if (!requestParams || locationState.status !== 'active') {
      fetchControllerRef.current?.abort()
      fetchControllerRef.current = null
      return
    }

    const controller = new AbortController()
    fetchControllerRef.current?.abort()
    fetchControllerRef.current = controller

    dispatch(fetchNearbyHotspots({ ...requestParams, signal: controller.signal }))

    return () => {
      controller.abort()
    }
  }, [dispatch, requestParams, locationState.status])

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
        triggered = {
          hotspot,
          distanceMeters: result.distanceMeters,
          muted:
            result.reason === 'channels-disabled' ||
            settings.alertChannels.length === 0,
        }
        break
      }

      if (result.reason === 'cooldown' && previous?.hotspot.id === hotspot.id) {
        triggered = {
          hotspot: previous.hotspot,
          distanceMeters: result.distanceMeters,
          muted: previous.muted,
        }
        break
      }
    }

    if (triggered) {
      const prev = activeAlertRef.current
      const isSameHotspot = prev?.hotspot.id === triggered.hotspot.id
      const hasChanges =
        !isSameHotspot ||
        Math.round(prev?.distanceMeters ?? -1) !==
          Math.round(triggered.distanceMeters) ||
        prev?.muted !== triggered.muted

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
          持續監測您的 GPS 位置，當進入高風險熱點時即時觸發警示。地圖互動與
          Mapbox 圖層將於後續任務整合。
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

        <div className="relative mt-sm h-[360px] overflow-hidden rounded-lg border border-gray-100 bg-surface-muted">
          <div className="grid h-full place-items-center text-text-secondary">
            地圖元件開發中，待 US3 導入 Mapbox GL JS
          </div>

          {activeAlert && (
            <div className="pointer-events-auto absolute left-1/2 top-4 w-full max-w-[90%] -translate-x-1/2 md:left-4 md:right-auto md:top-4 md:max-w-sm md:translate-x-0">
              <AlertOverlay
                hotspot={activeAlert.hotspot}
                distanceMeters={activeAlert.distanceMeters}
                isMuted={activeAlert.muted}
                onDismiss={handleDismissAlert}
                onIgnore={handleIgnoreHotspot}
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
          當前頁面提供警示流程與 UI，地圖渲染與熱點圖層將在 US3（T082-T088）中完成。
        </p>
      </div>
    </section>
  )
}

export default MapPage

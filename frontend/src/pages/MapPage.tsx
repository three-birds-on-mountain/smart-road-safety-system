import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type mapboxgl from 'mapbox-gl';
import AlertOverlay from '../components/Alert/AlertOverlay';
import MapView from '../components/Map/MapView';
import HotspotLayer from '../components/Map/HotspotLayer';
import UserLocation from '../components/Map/UserLocation';
import HotspotDetailPopup from '../components/Map/HotspotDetailPopup';
import HotspotIncidentListModal from '../components/Map/HotspotIncidentListModal';
import { useAppDispatch, useAppSelector } from '../hooks/store';
import { createAlertService, type TriggerAlertResult } from '../services/alerts';
import { createGeolocationService } from '../services/geolocation';
import {
  fetchHotspotDetail,
  fetchNearbyHotspots,
  setHotspotDetail,
  setNearbyHotspots,
} from '../store/hotspotsSlice';
import { toggleIgnoredHotspot } from '../store/settingsSlice';
import type { NearbyHotspot, HotspotSummary } from '../types/hotspot';
import type { AlertChannel } from '../types/settings';
import { getMockNearbyHotspots } from '../mocks/hotspots';

interface ActiveAlertState {
  hotspot: NearbyHotspot;
  distanceMeters: number;
  muted: boolean;
  channels: AlertChannel[];
  unsupportedChannels: AlertChannel[];
  reason?: TriggerAlertResult['reason'];
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
} as const;

const ENABLE_DEV_PREVIEW =
  import.meta.env.DEV && import.meta.env.VITE_DISABLE_MOCK_PREVIEW !== 'true';

const PREVIEW_LOCATION = {
  latitude: 25.040857,
  longitude: 121.560036,
};

const PREVIEW_ZOOM = 14;

const MapPage = () => {
  const dispatch = useAppDispatch();
  const locationState = useAppSelector((state) => state.location);
  const settings = useAppSelector((state) => state.settings.current);
  const hotspotsState = useAppSelector((state) => state.hotspots);
  const detailedHotspot = useAppSelector((state) => state.hotspots.detailedHotspot);
  const detailStatus = useAppSelector((state) => state.hotspots.detailStatus);
  const detailError = useAppSelector((state) => state.hotspots.detailError);
  const currentLocation = locationState.current;
  const locationStatus = locationState.status;
  const latitude = currentLocation?.latitude;
  const longitude = currentLocation?.longitude;

  const [activeAlert, setActiveAlert] = useState<ActiveAlertState | null>(null);
  const [selectedHotspot, setSelectedHotspot] = useState<HotspotSummary | null>(null);
  const [isDetailModalOpen, setDetailModalOpen] = useState(false);
  const [followUser, setFollowUser] = useState(true);

  const activeAlertRef = useRef<ActiveAlertState | null>(null);
  const geolocationServiceRef = useRef<ReturnType<typeof createGeolocationService> | null>(null);
  const alertServiceRef = useRef<ReturnType<typeof createAlertService> | null>(null);
  const fetchControllerRef = useRef<AbortController | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const hasAppliedPreviewRef = useRef(false);
  const [isMapReady, setIsMapReady] = useState(false);

  const fetchDependencies = useMemo(() => {
    if (latitude == null || longitude == null) {
      return null;
    }
    return {
      latitude,
      longitude,
      distance: settings.distanceMeters,
      severity: settings.severityFilter.join(','),
      timeRange: settings.timeRange,
    };
  }, [latitude, longitude, settings.distanceMeters, settings.severityFilter, settings.timeRange]);

  const updateActiveAlert = useCallback((next: ActiveAlertState | null) => {
    activeAlertRef.current = next;
    setActiveAlert(next);
  }, []);

  useEffect(() => {
    const service = createGeolocationService(dispatch);
    geolocationServiceRef.current = service;

    service.startWatching({
      onError: () => {
        // no-op: slice already handles error state
      },
    });

    return () => {
      service.reset();
      geolocationServiceRef.current = null;
    };
  }, [dispatch]);

  useEffect(() => {
    const previousService = alertServiceRef.current;
    previousService?.stop();

    const service = createAlertService({
      minIntervalMs: Math.max(settings.autoSilenceSeconds * 1000, 30_000),
    });
    alertServiceRef.current = service;

    return () => {
      service.stop();
      if (alertServiceRef.current === service) {
        alertServiceRef.current = null;
      }
    };
  }, [settings.autoSilenceSeconds]);

  useEffect(() => {
    if (!fetchDependencies || locationState.status !== 'active') {
      fetchControllerRef.current?.abort();
      fetchControllerRef.current = null;
      return;
    }

    if (
      ENABLE_DEV_PREVIEW &&
      hasAppliedPreviewRef.current &&
      import.meta.env.VITE_USE_MOCK_API !== 'true'
    ) {
      return;
    }

    const controller = new AbortController();
    fetchControllerRef.current?.abort();
    fetchControllerRef.current = controller;

    dispatch(
      fetchNearbyHotspots({
        latitude: fetchDependencies.latitude,
        longitude: fetchDependencies.longitude,
        signal: controller.signal,
      }),
    );

    return () => {
      controller.abort();
    };
  }, [dispatch, fetchDependencies, locationState.status]);

  useEffect(() => {
    const alertService = alertServiceRef.current;
    const currentLocation = locationState.current;

    if (!alertService || !currentLocation) {
      if (activeAlertRef.current) {
        alertService?.silence();
        updateActiveAlert(null);
      }
      return;
    }

    const nearby = hotspotsState.nearby;

    if (!nearby.length) {
      if (activeAlertRef.current) {
        alertService.silence();
        updateActiveAlert(null);
      }
      return;
    }

    let triggered: ActiveAlertState | null = null;
    const previous = activeAlertRef.current;

    for (const hotspot of nearby) {
      const result = alertService.triggerAlert({
        hotspot,
        userLocation: currentLocation,
        settings,
      });

      if (result.triggered) {
        const muted =
          result.activatedChannels.length === 0 ||
          result.reason === 'channels-disabled' ||
          result.reason === 'unsupported';

        triggered = {
          hotspot,
          distanceMeters: result.distanceMeters,
          muted,
          channels: result.activatedChannels,
          unsupportedChannels: result.unsupportedChannels ?? [],
          reason: result.reason,
        };
        break;
      }

      if (result.reason === 'cooldown' && previous?.hotspot.id === hotspot.id) {
        triggered = {
          hotspot: previous.hotspot,
          distanceMeters: result.distanceMeters,
          muted: previous.muted,
          channels: previous.channels,
          unsupportedChannels: previous.unsupportedChannels,
          reason: result.reason,
        };
        break;
      }
    }

    if (triggered) {
      const prev = activeAlertRef.current;
      const isSameHotspot = prev?.hotspot.id === triggered.hotspot.id;
      const sameChannels =
        prev &&
        prev.channels.length === triggered.channels.length &&
        prev.channels.every((channel, index) => channel === triggered.channels[index]);
      const sameUnsupported =
        prev &&
        prev.unsupportedChannels.length === triggered.unsupportedChannels.length &&
        prev.unsupportedChannels.every(
          (channel, index) => channel === triggered.unsupportedChannels[index],
        );
      const hasChanges =
        !isSameHotspot ||
        Math.round(prev?.distanceMeters ?? -1) !== Math.round(triggered.distanceMeters) ||
        prev?.muted !== triggered.muted ||
        !sameChannels ||
        !sameUnsupported ||
        prev?.reason !== triggered.reason;

      if (hasChanges) {
        updateActiveAlert(triggered);
      }
      return;
    }

    if (activeAlertRef.current) {
      alertService.silence();
      updateActiveAlert(null);
    }
  }, [hotspotsState, locationState, settings, updateActiveAlert]);

  const handleDismissAlert = () => {
    alertServiceRef.current?.silence();
    updateActiveAlert(null);
  };

  const handleIgnoreHotspot = (hotspotId: string) => {
    dispatch(toggleIgnoredHotspot(hotspotId));
    alertServiceRef.current?.clearHotspotCooldown(hotspotId);
    alertServiceRef.current?.silence();
    updateActiveAlert(null);
  };

  const gpsDescriptor = gpsStatusDescriptor[locationState.status] ?? gpsStatusDescriptor.idle;
  const shouldShowGpsBadge = locationState.status !== 'active' && gpsDescriptor.label.length > 0;
  const showPermissionPrompt =
    locationState.permissionGranted === false && locationState.status === 'error';

  const activeHotspotDetail =
    selectedHotspot && detailedHotspot && detailedHotspot.id === selectedHotspot.id
      ? detailedHotspot
      : undefined;

  const handleMapLoad = useCallback((map: mapboxgl.Map) => {
    mapRef.current = map;
    setIsMapReady(true);
    map.on('remove', () => {
      if (mapRef.current === map) {
        mapRef.current = null;
      }
      setIsMapReady(false);
    });
  }, []);

  useEffect(() => {
    return () => {
      mapRef.current = null;
      setIsMapReady(false);
    };
  }, []);

  const handleRecenter = useCallback(() => {
    const mapInstance = mapRef.current;
    if (!mapInstance) {
      return;
    }

    if (latitude != null && longitude != null) {
      setFollowUser(true);
      mapInstance.easeTo({
        center: [longitude, latitude],
        zoom: Math.max(mapInstance.getZoom(), 15),
        duration: 800,
      });
      return;
    }

    geolocationServiceRef.current?.startWatching();
  }, [latitude, longitude]);

  const handleOpenLocationSettings = () => {
    geolocationServiceRef.current?.startWatching();

    if (typeof window === 'undefined') {
      return;
    }

    const userAgent = window.navigator?.userAgent ?? '';

    try {
      if (/android/i.test(userAgent)) {
        window.location.href =
          'intent://settings/location#Intent;scheme=android-app;package=com.android.settings;end';
        return;
      }

      if (/iphone|ipad|ipod/i.test(userAgent)) {
        window.location.href = 'App-Prefs:root=Privacy&path=LOCATION_SERVICES';
        window.setTimeout(() => {
          window.location.href = 'app-settings:';
        }, 200);
        return;
      }
    } catch (error) {
      console.warn('Failed to open system settings automatically:', error);
    }

    window.open(
      'https://support.google.com/chrome/answer/142065?hl=zh-Hant',
      '_blank',
      'noopener,noreferrer',
    );
  };

  useEffect(() => {
    if (!selectedHotspot) {
      dispatch(setHotspotDetail(undefined));
      setDetailModalOpen(false);
      return;
    }

    const controller = new AbortController();
    dispatch(
      fetchHotspotDetail({
        hotspotId: selectedHotspot.id,
        signal: controller.signal,
      }),
    );

    return () => {
      controller.abort();
    };
  }, [dispatch, selectedHotspot]);

  useEffect(() => {
    if (!ENABLE_DEV_PREVIEW || hasAppliedPreviewRef.current || !isMapReady) {
      return;
    }

    const hasRealData = hotspotsState.nearby.some(
      (hotspot) => hotspot && !hotspot.id.startsWith('mock-'),
    );

    if (hasRealData) {
      hasAppliedPreviewRef.current = true;
      return;
    }

    const mockResponse = getMockNearbyHotspots({
      latitude: PREVIEW_LOCATION.latitude,
      longitude: PREVIEW_LOCATION.longitude,
      settings,
    });

    if (mockResponse.data.length && hotspotsState.nearby.length === 0) {
      dispatch(setNearbyHotspots(mockResponse.data));
    }

    if (mapRef.current) {
      mapRef.current.jumpTo({
        center: [PREVIEW_LOCATION.longitude, PREVIEW_LOCATION.latitude],
        zoom: PREVIEW_ZOOM,
      });
    }

    hasAppliedPreviewRef.current = true;
  }, [
    currentLocation,
    dispatch,
    hotspotsState.nearby,
    isMapReady,
    locationStatus,
    settings,
  ]);

  const mapCenter =
    followUser && latitude != null && longitude != null ? [longitude, latitude] : undefined;
  const mapZoom = followUser ? 13 : undefined;

  return (
    <div className="relative h-screen w-screen">
      {/* 全螢幕地圖 */}
      <div className="absolute inset-0">
        <MapView
          className="h-full w-full"
          center={mapCenter}
          zoom={mapZoom}
          onMapLoad={handleMapLoad}
        >
          {(map) =>
            map && (
              <>
                <HotspotLayer
                  map={map}
                  hotspots={hotspotsState.nearby}
                  onHotspotClick={(hotspot) => {
                    setFollowUser(false);
                    setSelectedHotspot(hotspot);
                  }}
                  enableClustering={true}
                />
                <UserLocation
                  map={map}
                  latitude={latitude ?? null}
                  longitude={longitude ?? null}
                  showAccuracyCircle={true}
                  heading={currentLocation?.heading ?? null}
                  accuracy={currentLocation?.accuracy ?? 20}
                />
              </>
            )
          }
        </MapView>
      </div>

      {/* 回到定位按鈕 */}
      <div className="pointer-events-none absolute right-4 top-[120px] z-10">
        <button
          type="button"
          onClick={handleRecenter}
          className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-md bg-surface-white p-1.5 text-text-primary shadow-md transition hover:bg-primary-50 hover:text-primary-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 active:shadow-sm"
          aria-label="回到我的位置"
        >
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M12 3v2.75M12 18.25V21M3 12h2.75M18.25 12H21"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth={1.8}
            />
            <circle
              cx="12"
              cy="12"
              r="6.5"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
            />
            <circle cx="12" cy="12" r="2.5" fill="currentColor" />
          </svg>
        </button>
      </div>

      {/* GPS 狀態指示器（左上角） */}
      <div className="pointer-events-none absolute left-4 top-4 z-10 flex flex-col gap-2">
        {shouldShowGpsBadge && (
          <span
            className={[
              'pointer-events-auto rounded-full px-3 py-1.5 text-xs font-semibold shadow-md',
              gpsDescriptor.className,
            ].join(' ')}
          >
            {gpsDescriptor.label}
          </span>
        )}

        {showPermissionPrompt && (
          <div className="pointer-events-auto flex flex-col gap-2 rounded-md bg-surface-white px-3 py-2 text-xs text-text-secondary shadow-md">
            <span className="font-semibold text-text-primary">定位權限未啟用</span>
            <button
              type="button"
              onClick={handleOpenLocationSettings}
              className="inline-flex w-full items-center justify-center gap-1 rounded-md bg-primary-500 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500/60"
            >
              開啟系統定位設定
            </button>
          </div>
        )}

        {locationState.error && (
          <div className="pointer-events-auto rounded-md border border-danger-500 bg-danger-500/95 px-3 py-2 text-xs text-white shadow-md">
            {locationState.error}
          </div>
        )}

        {hotspotsState.status === 'loading' && (
          <span className="pointer-events-auto rounded-md bg-primary-600/95 px-3 py-1.5 text-xs text-white shadow-md">
            取得附近熱點中…
          </span>
        )}

        {hotspotsState.status === 'failed' && hotspotsState.error && (
          <span className="pointer-events-auto rounded-md bg-danger-500/95 px-3 py-1.5 text-xs text-white shadow-md">
            載入失敗
          </span>
        )}
      </div>

      {/* 警示覆蓋層（簡化版：底部浮動顯示） */}
      {activeAlert && (
        <div className="pointer-events-none absolute bottom-24 left-4 right-4 z-20 flex justify-center">
          <div className="pointer-events-auto w-full max-w-md">
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
        </div>
      )}

      {/* 熱點詳情彈窗（置於地圖上方，右上角） */}
      {selectedHotspot && (
        <div className="pointer-events-none absolute right-4 top-4 z-20 max-w-[90%] md:max-w-sm">
          <div className="pointer-events-auto">
            <HotspotDetailPopup
              hotspot={selectedHotspot}
              detail={activeHotspotDetail}
              detailStatus={detailStatus}
              detailError={detailError}
              onShowFullDetail={() => {
                if (detailStatus === 'failed') return;
                setDetailModalOpen(true);
              }}
              onClose={() => setSelectedHotspot(null)}
            />
          </div>
        </div>
      )}

      {isDetailModalOpen && (
        <div className="fixed inset-0 z-[110] bg-surface-muted/70 backdrop-blur-sm">
          {detailStatus === 'succeeded' && activeHotspotDetail ? (
            <HotspotIncidentListModal
              hotspot={activeHotspotDetail}
              onClose={() => setDetailModalOpen(false)}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="flex flex-col items-center gap-3 rounded-lg bg-white px-6 py-5 shadow-xl">
                {detailStatus === 'failed' ? (
                  <>
                    <svg
                      className="h-10 w-10 text-danger-500"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01" />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M10.29 3.86L1.82 18a1 1 0 00.86 1.5h18.64a1 1 0 00.86-1.5L13.71 3.86a1 1 0 00-1.72 0z"
                      />
                    </svg>
                    <p className="text-sm font-semibold text-danger-600">
                      無法載入事故詳情
                    </p>
                    {detailError && (
                      <p className="text-xs text-text-secondary text-center">{detailError}</p>
                    )}
                  </>
                ) : (
                  <>
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
                    <p className="text-sm text-text-secondary">載入事故詳情中…</p>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setDetailModalOpen(false)}
                  className="rounded-md border border-gray-200 px-3 py-1 text-xs text-text-secondary transition hover:bg-gray-50"
                >
                  關閉
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MapPage;

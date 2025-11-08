import { useCallback, useEffect, useRef, useState } from 'react';
import AlertOverlay from '../components/Alert/AlertOverlay';
import MapView from '../components/Map/MapView';
import HotspotLayer from '../components/Map/HotspotLayer';
import UserLocation from '../components/Map/UserLocation';
import RouteLayer from '../components/Map/RouteLayer';
import HotspotDetailPopup from '../components/Map/HotspotDetailPopup';
import HotspotIncidentListModal from '../components/Map/HotspotIncidentListModal';
import SearchContainer, { type SearchPoint } from '../components/RouteSearch/SearchContainer';
import RouteSummary from '../components/RouteDisplay/RouteSummary';
import { useAppDispatch, useAppSelector } from '../hooks/store';
import { createAlertService, type TriggerAlertResult } from '../services/alerts';
import { createGeolocationService } from '../services/geolocation';
import { FlutterBridge } from '../services/flutterBridge';
import {
  fetchAllHotspots,
  fetchHotspotDetail,
  setHotspotDetail,
  setNearbyHotspots,
  setHotspots,
} from '../store/hotspotsSlice';
import { toggleIgnoredHotspot } from '../store/settingsSlice';
import {
  setDestination,
  setRoute,
  setSafetySummary,
  setRouteLoading,
  setRouteError,
  clearRoute,
} from '../store/routeSlice';
import type { NearbyHotspot, HotspotSummary } from '../types/hotspot';
import type { AlertChannel } from '../types/settings';
import { getMockNearbyHotspots } from '../mocks/hotspots';
import type { MapboxInstance } from '../lib/mapbox';
import { getDirections } from '../services/mapboxApi';
import { calculateRouteSafety } from '../utils/routeAccidentCalculator';
import mapMarkPointer from '../assets/map-mark-pointer.svg';
import mapMarkPointerPress from '../assets/map-mark-pointer-press.svg';

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
  const routeState = useAppSelector((state) => state.route);
  const currentLocation = locationState.current;
  const locationStatus = locationState.status;
  const latitude = currentLocation?.latitude;
  const longitude = currentLocation?.longitude;

  const [activeAlert, setActiveAlert] = useState<ActiveAlertState | null>(null);
  const [selectedHotspot, setSelectedHotspot] = useState<HotspotSummary | null>(null);
  const [isDetailModalOpen, setDetailModalOpen] = useState(false);
  const [followUser, setFollowUser] = useState(true);
  const [isRecenterPressed, setIsRecenterPressed] = useState(false);
  const [showRouteSearch, setShowRouteSearch] = useState(false);
  const [isRouteSummaryVisible, setIsRouteSummaryVisible] = useState(true);

  const activeAlertRef = useRef<ActiveAlertState | null>(null);
  const geolocationServiceRef = useRef<ReturnType<typeof createGeolocationService> | null>(null);
  const alertServiceRef = useRef<ReturnType<typeof createAlertService> | null>(null);
  const mapRef = useRef<MapboxInstance | null>(null);
  const hasAppliedPreviewRef = useRef(false);
  const [isMapReady, setIsMapReady] = useState(false);

  // 前端過濾邏輯：根據設定篩選和過濾熱點
  useEffect(() => {
    const allHotspots = hotspotsState.allHotspots;

    if (allHotspots.length === 0) {
      return;
    }

    // 匯入過濾函式並執行過濾
    (async () => {
      const { filterBySeverity, filterByTimeRange, filterByDistance, filterByAccidentThreshold } = await import(
        '../utils/hotspotFilters'
      );

      // 1. 先套用時間範圍和嚴重程度過濾
      let filtered = filterByTimeRange(allHotspots, settings.timeRange);

      filtered = filterBySeverity(filtered, settings.severityFilter);

      // 2. 套用事故數量門檻過濾
      filtered = filterByAccidentThreshold(filtered, settings.accidentThreshold ?? 1);

      // 3. 設定地圖顯示的熱點（所有符合條件的）
      dispatch(setHotspots(filtered));

      // 4. 如果有使用者位置，計算附近熱點用於警示
      if (latitude != null && longitude != null) {
        const nearby = filterByDistance(filtered, latitude, longitude, settings.distanceMeters);
        dispatch(setNearbyHotspots(nearby));
      }
    })();
  }, [
    hotspotsState.allHotspots,
    settings.timeRange,
    settings.severityFilter,
    settings.distanceMeters,
    settings.accidentThreshold,
    latitude,
    longitude,
    dispatch,
  ]);

  const updateActiveAlert = useCallback((next: ActiveAlertState | null) => {
    activeAlertRef.current = next;
    setActiveAlert(next);
  }, []);

  // 一次性載入所有熱點
  useEffect(() => {
    const controller = new AbortController();

    dispatch(fetchAllHotspots({ signal: controller.signal }));

    return () => {
      controller.abort();
    };
  }, [dispatch]);

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

  const handleMapLoad = useCallback((map: MapboxInstance) => {
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

  const handleRecenterPressStart = useCallback(() => {
    setIsRecenterPressed(true);
  }, []);

  const handleRecenterPressEnd = useCallback(() => {
    setIsRecenterPressed(false);
  }, []);

  // 路線規劃相關處理
  const handleRouteRequest = useCallback(
    async (origin: SearchPoint, destination: SearchPoint) => {
      try {
        dispatch(setRouteLoading());
        dispatch(setDestination(destination));

        // 呼叫 Mapbox Directions API
        const directions = await getDirections(
          [
            [origin.lng, origin.lat],
            [destination.lng, destination.lat],
          ],
          { profile: 'driving-traffic' },
        );

        if (!directions.routes || directions.routes.length === 0) {
          dispatch(setRouteError('無法找到路線'));
          return;
        }

        const route = {
          geometry: directions.routes[0].geometry,
          distance: directions.routes[0].distance,
          duration: directions.routes[0].duration,
        };

        dispatch(setRoute(route));

        // 計算路線安全統計
        const filteredHotspots = hotspotsState.items;
        const safetySummary = calculateRouteSafety(route.geometry, filteredHotspots, 200);

        dispatch(setSafetySummary(safetySummary));

        // 停止追蹤使用者位置（讓地圖顯示完整路線）
        setFollowUser(false);
      } catch (error) {
        console.error('路線規劃失敗:', error);
        dispatch(setRouteError('路線規劃失敗，請稍後再試'));
      }
    },
    [dispatch, hotspotsState.items],
  );

  const handleClearRoute = useCallback(() => {
    dispatch(clearRoute());
    setShowRouteSearch(false);
    setIsRouteSummaryVisible(true); // 重置抽屜狀態
  }, [dispatch]);

  const toggleRouteSummary = useCallback(() => {
    setIsRouteSummaryVisible((prev) => !prev);
  }, []);

  // 當新路線產生時，自動展開抽屜
  useEffect(() => {
    if (routeState.safetySummary) {
      setIsRouteSummaryVisible(true);
    }
  }, [routeState.safetySummary]);

  const handleOpenLocationSettings = async () => {
    console.log('🔍 handleOpenLocationSettings 被呼叫');
    
    if (typeof window === 'undefined') {
      console.log('❌ window 未定義');
      return;
    }

    // 檢查是否在 Flutter WebView 環境
    const isFlutterApp = typeof window.flutterObject?.postMessage === 'function';
    console.log('📱 是否在 Flutter App 中:', isFlutterApp);

    // 如果在 Flutter App 中，使用 Flutter Bridge 開啟系統設定
    if (isFlutterApp) {
      try {
        const bridge = new FlutterBridge();
        await bridge.openAppSettings();
        return;
      } catch (error) {
        console.warn('Failed to open app settings via Flutter Bridge:', error);
      }
    }

    // 在瀏覽器環境下，嘗試檢查並處理權限
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      // 嘗試使用 Permissions API 檢查狀態
      if (navigator.permissions) {
        console.log('✅ navigator.permissions 可用，開始檢查權限狀態');
        try {
          const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
          console.log('📍 權限狀態:', permissionStatus.state);
          
          if (permissionStatus.state === 'prompt') {
            // 如果是 prompt 狀態，請求定位會觸發權限對話框
            console.log('⏸️ 權限狀態為 prompt，嘗試觸發權限請求');
            geolocationServiceRef.current?.startWatching();
            return;
          }
          
          if (permissionStatus.state === 'denied') {
            // 如果已經被拒絕，提示使用者手動開啟
            console.log('🚫 權限已被拒絕，顯示提示訊息');
            alert(
              '定位權限已被拒絕。\n\n' +
              '請點擊網址列左側的鎖頭圖示 🔒，\n' +
              '找到「位置」或「定位」設定，\n' +
              '將其改為「允許」，\n' +
              '然後重新整理頁面。'
            );
            return;
          }
          
          if (permissionStatus.state === 'granted') {
            console.log('✅ 權限已授予，重新啟動定位服務');
            geolocationServiceRef.current?.startWatching();
            return;
          }
        } catch (error) {
          console.warn('⚠️ 檢查權限狀態失敗:', error);
          // 繼續嘗試直接請求
        }
      }
      
      // 如果 Permissions API 不可用或檢查失敗，嘗試直接請求定位
      console.log('🔄 嘗試直接請求定位權限');
      try {
        await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            resolve,
            reject,
            {
              enableHighAccuracy: true,
              timeout: 5000,
              maximumAge: 0,
            }
          );
        });
        console.log('✅ 定位請求成功');
        geolocationServiceRef.current?.startWatching();
        return;
      } catch (error: any) {
        console.error('❌ 定位請求失敗:', error);
        if (error.code === error.PERMISSION_DENIED) {
          alert(
            '定位權限已被拒絕。\n\n' +
            '請點擊網址列左側的鎖頭圖示 🔒，\n' +
            '找到「位置」或「定位」設定，\n' +
            '將其改為「允許」，\n' +
            '然後重新整理頁面。'
          );
          return;
        }
      }
    }

    // 如果以上都失敗，且在移動裝置上，嘗試開啟系統設定
    const userAgent = window.navigator?.userAgent ?? '';
    console.log('📱 User Agent:', userAgent);

    try {
      if (/android/i.test(userAgent)) {
        console.log('🤖 Android 裝置，嘗試開啟系統設定');
        window.location.href =
          'intent://settings/location#Intent;scheme=android-app;package=com.android.settings;end';
        return;
      }

      if (/iphone|ipad|ipod/i.test(userAgent)) {
        console.log('🍎 iOS 裝置，嘗試開啟系統設定');
        window.location.href = 'App-Prefs:root=Privacy&path=LOCATION_SERVICES';
        window.setTimeout(() => {
          window.location.href = 'app-settings:';
        }, 200);
        return;
      }
    } catch (error) {
      console.warn('Failed to open system settings automatically:', error);
    }

    // 最後的 fallback：顯示提示訊息而不是跳轉
    console.log('ℹ️ 顯示最終提示訊息');
    alert(
      '無法自動開啟定位設定。\n\n' +
      '請手動在瀏覽器中啟用定位權限：\n' +
      '1. 點擊網址列左側的鎖頭圖示 🔒\n' +
      '2. 找到「位置」或「定位」設定\n' +
      '3. 將其改為「允許」\n' +
      '4. 重新整理頁面'
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
  }, [currentLocation, dispatch, hotspotsState.nearby, isMapReady, locationStatus, settings]);

  const mapCenter =
    followUser && latitude != null && longitude != null
      ? ([longitude, latitude] as [number, number])
      : undefined;
  const mapZoom = followUser ? 13 : undefined;
  const showDataUpdatingOverlay =
    hotspotsState.status === 'loading' && hotspotsState.items.length === 0;

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
                  hotspots={hotspotsState.items}
                  onHotspotClick={(hotspot) => {
                    setFollowUser(false);
                    setSelectedHotspot(hotspot);
                  }}
                  enableClustering={true}
                  severityFilter={settings.severityFilter}
                />
                <UserLocation
                  map={map}
                  latitude={latitude ?? null}
                  longitude={longitude ?? null}
                  showAccuracyCircle={true}
                  heading={currentLocation?.heading ?? null}
                  accuracy={currentLocation?.accuracy ?? 20}
                />
                {routeState.route && (
                  <RouteLayer map={map} routeGeometry={routeState.route.geometry} />
                )}
              </>
            )
          }
        </MapView>
        {showDataUpdatingOverlay && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <div className="rounded-xl bg-surface-white/90 px-4 py-3 text-sm font-semibold text-text-secondary shadow-xl">
              資料更新中，請稍候...
            </div>
          </div>
        )}
      </div>

      {/* 回到定位按鈕（位於設定按鈕上方） */}
      <div className="pointer-events-none fixed right-6 bottom-[150px] z-50">
        <button
          type="button"
          onClick={handleRecenter}
          onPointerDown={handleRecenterPressStart}
          onPointerUp={handleRecenterPressEnd}
          onPointerLeave={handleRecenterPressEnd}
          onBlur={handleRecenterPressEnd}
          className="pointer-events-auto flex h-[54px] w-[54px] items-center justify-center rounded-full text-text-primary shadow-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          style={{ backgroundColor: 'rgba(255, 255, 255, 1)' }}
          aria-label="回到我的位置"
        >
          <span className="relative block h-6 w-6">
            <img
              src={mapMarkPointer}
              alt=""
              className={[
                'absolute inset-0 h-full w-full transition-opacity duration-150',
                isRecenterPressed ? 'opacity-0' : 'opacity-100',
              ].join(' ')}
              aria-hidden="true"
            />
            <img
              src={mapMarkPointerPress}
              alt=""
              className={[
                'absolute inset-0 h-full w-full transition-opacity duration-150',
                isRecenterPressed ? 'opacity-100' : 'opacity-0',
              ].join(' ')}
              aria-hidden="true"
            />
          </span>
        </button>
      </div>

      {/* 路線搜尋按鈕（左上角） */}
      <div className="pointer-events-none absolute left-4 top-4 z-10">
        {!showRouteSearch && (
          <button
            type="button"
            onClick={() => setShowRouteSearch(true)}
            className="pointer-events-auto flex items-center gap-2 rounded-lg bg-white px-4 py-2 shadow-lg transition hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            aria-label="規劃路線"
          >
            <svg className="h-5 w-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
              />
            </svg>
            <span className="text-sm font-medium text-text-primary">規劃路線</span>
          </button>
        )}
      </div>

      {/* 路線搜尋框（展開時） */}
      {showRouteSearch && (
        <div className="pointer-events-none absolute left-4 top-4 right-4 z-20 md:right-auto md:w-96">
          <div className="pointer-events-auto rounded-lg bg-white p-4 shadow-xl">
            {/* 標題列 */}
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">路線規劃</h3>
              <button
                type="button"
                onClick={() => {
                  setShowRouteSearch(false);
                  if (routeState.route) {
                    handleClearRoute();
                  }
                }}
                className="flex h-6 w-6 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                aria-label="關閉"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 搜尋容器 */}
            <SearchContainer
              onRouteRequest={handleRouteRequest}
              onClear={handleClearRoute}
              isLoading={routeState.status === 'loading'}
              error={routeState.error}
            />
          </div>
        </div>
      )}

      {/* GPS 狀態指示器（搜尋框下方） */}
      <div className={`pointer-events-none absolute left-4 z-10 flex flex-col gap-2 ${showRouteSearch ? 'top-[200px]' : 'top-[60px]'}`}>
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

        {hotspotsState.nearbyStatus === 'loading' && (
          <span className="pointer-events-auto rounded-md bg-primary-600/95 px-3 py-1.5 text-xs text-white shadow-md">
            取得附近熱點中…
          </span>
        )}

        {hotspotsState.nearbyStatus === 'failed' && hotspotsState.nearbyError && (
          <span className="pointer-events-auto rounded-md bg-danger-500/95 px-3 py-1.5 text-xs text-white shadow-md">
            載入附近熱點失敗
          </span>
        )}
      </div>

      {/* 路線安全統計抽屜 */}
      {routeState.safetySummary && (
        <RouteSummary
          summary={routeState.safetySummary}
          isVisible={isRouteSummaryVisible}
          onToggle={toggleRouteSummary}
          onClearRoute={handleClearRoute}
        />
      )}

      {/* 顯示路線統計浮動按鈕（當抽屜隱藏且有路線時顯示） */}
      {routeState.safetySummary && !isRouteSummaryVisible && (
        <div className="pointer-events-none fixed right-6 bottom-[90px] z-50">
          <button
            type="button"
            onClick={toggleRouteSummary}
            className="pointer-events-auto flex items-center gap-2 rounded-full bg-primary-500 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-primary-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            aria-label="顯示路線統計"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            <span>路線統計</span>
          </button>
        </div>
      )}

      {/* 警示覆蓋層（簡化版：底部浮動顯示） */}
      {activeAlert && !routeState.safetySummary && (
        <div className="pointer-events-none absolute top-8 left-4 right-4 z-20 flex justify-center">
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
                    <p className="text-sm font-semibold text-danger-600">無法載入事故詳情</p>
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

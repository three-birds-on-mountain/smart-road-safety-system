import {
  resetLocation,
  setGPSStatus,
  setLocationError,
  setPermissionGranted,
  updateLocation,
  type Coordinates,
} from '../store/locationSlice';
import { isFlutterBridgeAvailable, postMessage, requestLocation, subscribeToBridgeEvent } from './flutterBridge';
import type { AppDispatch } from '../store';
import type { GPSStatus } from '../types/settings';
import type { BridgePosition } from './flutterBridge';

const defaultOptions: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 5_000,
  timeout: 10_000,
};

const permissionDeniedMessage = '定位權限被拒絕，請於瀏覽器設定中允許定位權限。';

export interface GeolocationServiceOptions {
  onLocationUpdate?: (coordinates: Coordinates) => void;
  onStatusChange?: (status: GPSStatus) => void;
  onError?: (error: Error) => void;
}

interface WatchState {
  isWatching: boolean;
  unsubscribe?: () => void;
  nativeWatchId: number | null;
}

const unsupportedMessage =
  'Flutter 裝置尚未連線，無法取得定位資料。請確認 App 以 WebView 執行並授予定位權限。';

const bridgeNotReadyError = new Error(unsupportedMessage);

const adaptBridgePosition = (position: BridgePosition): Coordinates => ({
  latitude: position.latitude,
  longitude: position.longitude,
  accuracy: position.accuracy,
  heading: position.heading ?? null,
  speed: position.speed ?? null,
  timestamp: position.timestamp ?? Date.now(),
});

export const createGeolocationService = (dispatch: AppDispatch) => {
  const state: WatchState = {
    isWatching: false,
    unsubscribe: undefined,
    nativeWatchId: null,
  };

  const emitStatus = (status: GPSStatus, options?: GeolocationServiceOptions) => {
    dispatch(setGPSStatus(status));
    options?.onStatusChange?.(status);
  };

  const handleLocationUpdate = (position: BridgePosition, options?: GeolocationServiceOptions) => {
    const normalized = adaptBridgePosition(position);
    dispatch(setPermissionGranted(true));
    dispatch(updateLocation(normalized));

    if (normalized.accuracy && normalized.accuracy > 50) {
      dispatch(
        setLocationError(
          `GPS 訊號較弱（精確度: ${Math.round(
            normalized.accuracy,
          )} 公尺），警示功能可能受影響。`,
        ),
      );
    } else {
      dispatch(setLocationError(undefined));
    }

    emitStatus('active', options);
    options?.onLocationUpdate?.(normalized);
  };

  const startBridgeWatcher = (options?: GeolocationServiceOptions) => {
    if (state.isWatching) {
      return;
    }

    emitStatus('locating', options);
    dispatch(setLocationError(undefined));

    state.unsubscribe = subscribeToBridgeEvent('location', (payload) => {
      if (!payload || typeof payload !== 'object') {
        return;
      }
      handleLocationUpdate(payload as BridgePosition, options);
    });

    state.isWatching = true;

    // 使用簡單的 'location' 訊息（與 tpml-seat-tracker 一致）
    requestLocation()
      .then((position) => handleLocationUpdate(position, options))
      .catch((error: Error) => {
        dispatch(setLocationError(error.message));
        emitStatus('error', options);
        options?.onError?.(error);
      });
  };

  const stopNativeWatcher = () => {
    if (state.nativeWatchId && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(state.nativeWatchId);
    }
    state.nativeWatchId = null;
  };

  const startNativeWatcher = (options?: GeolocationServiceOptions) => {
    if (state.nativeWatchId) {
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      dispatch(setPermissionGranted(false));
      dispatch(setLocationError(unsupportedMessage));
      emitStatus('unsupported', options);
      options?.onError?.(bridgeNotReadyError);
      return;
    }

    emitStatus('locating', options);
    dispatch(setLocationError(undefined));

    const watchId = navigator.geolocation.watchPosition(
      ({ coords, timestamp }) => {
        const position: Coordinates = {
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
          heading: 'heading' in coords ? (coords as GeolocationCoordinates).heading ?? null : null,
          speed: 'speed' in coords ? (coords as GeolocationCoordinates).speed ?? null : null,
          timestamp,
        };

        dispatch(setPermissionGranted(true));
        dispatch(updateLocation(position));

        if (coords.accuracy > 50) {
          dispatch(
            setLocationError(
              `GPS 訊號較弱（精確度: ${Math.round(
                coords.accuracy,
              )} 公尺），警示功能可能受影響。`,
            ),
          );
        } else {
          dispatch(setLocationError(undefined));
        }

        emitStatus('active', options);
        options?.onLocationUpdate?.(position);
      },
      (error) => {
        dispatch(setLocationError(error.message));

        if (error.code === error.PERMISSION_DENIED) {
          dispatch(setPermissionGranted(false));
          emitStatus('error', options);
          options?.onError?.(new Error(permissionDeniedMessage));
          stopNativeWatcher();
          return;
        }

        emitStatus('error', options);
        options?.onError?.(new Error(error.message));
      },
      defaultOptions,
    );

    state.nativeWatchId = watchId;
    state.isWatching = true;
  };

  const startWatching = (options?: GeolocationServiceOptions) => {
    if (isFlutterBridgeAvailable()) {
      startBridgeWatcher(options);
      return;
    }
    startNativeWatcher(options);
  };

  const stopWatching = () => {
    if (state.unsubscribe) {
      state.unsubscribe();
      state.unsubscribe = undefined;
    }
    if (isFlutterBridgeAvailable()) {
      postMessage({ name: 'location:stop' });
    }
    stopNativeWatcher();
    state.isWatching = false;
    dispatch(setGPSStatus('idle'));
  };

  const reset = () => {
    stopWatching();
    dispatch(resetLocation());
  };

  const getCurrentPosition = async (): Promise<Coordinates | undefined> => {
    if (!isFlutterBridgeAvailable()) {
      return undefined;
    }
    try {
      const position = await requestLocation();
      return adaptBridgePosition(position);
    } catch (error) {
      console.warn('Failed to request single location update:', error);
      return undefined;
    }
  };

  return {
    startWatching,
    stopWatching,
    reset,
    getCurrentPosition,
    isWatching: () => state.isWatching,
  };
};

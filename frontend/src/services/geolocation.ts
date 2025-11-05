import {
  resetLocation,
  setGPSStatus,
  setLocationError,
  setPermissionGranted,
  updateLocation,
  type Coordinates,
} from '../store/locationSlice';
import type { AppDispatch } from '../store';
import type { GPSStatus } from '../types/settings';

export interface GeolocationServiceOptions extends PositionOptions {
  onLocationUpdate?: (coordinates: Coordinates) => void;
  onStatusChange?: (status: GPSStatus) => void;
  onError?: (error: GeolocationPositionError | Error) => void;
}

interface WatchState {
  watchId: number | null;
  isWatching: boolean;
}

const defaultOptions: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 5_000,
  timeout: 10_000,
};

const permissionDeniedMessage = '定位權限被拒絕，請於瀏覽器設定中允許定位權限。';
const unsupportedMessage = '此裝置不支援地理定位功能。';

export const createGeolocationService = (dispatch: AppDispatch) => {
  const state: WatchState = {
    watchId: null,
    isWatching: false,
  };

  const stopWatching = () => {
    if (typeof navigator !== 'undefined' && state.watchId !== null) {
      navigator.geolocation.clearWatch(state.watchId);
    }
    state.watchId = null;
    state.isWatching = false;
    dispatch(setGPSStatus('idle'));
  };

  const emitStatus = (status: GPSStatus, options?: GeolocationServiceOptions) => {
    dispatch(setGPSStatus(status));
    options?.onStatusChange?.(status);
  };

  const handleSuccess =
    (options?: GeolocationServiceOptions) =>
    ({ coords, timestamp }: GeolocationPosition) => {
      const coordinates: Coordinates = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        heading: 'heading' in coords ? (coords as GeolocationCoordinates).heading ?? null : null,
        speed: 'speed' in coords ? (coords as GeolocationCoordinates).speed ?? null : null,
        timestamp,
      };

      dispatch(setPermissionGranted(true));
      dispatch(updateLocation(coordinates));

      // T119: GPS 訊號弱處理
      // 根據 accuracy (精確度) 判斷訊號強度
      // accuracy 單位為公尺，值越大表示越不準確
      const isWeakSignal = coords.accuracy > 50 // 精確度 > 50 公尺視為訊號弱

      if (isWeakSignal) {
        dispatch(
          setLocationError(
            `GPS 訊號較弱（精確度: ${Math.round(coords.accuracy)} 公尺），警示功能可能受影響。`
          )
        );
      } else {
        // 訊號正常，清除錯誤訊息
        dispatch(setLocationError(undefined));
      }

      emitStatus('active', options);
      options?.onLocationUpdate?.(coordinates);
    };

  const handleError =
    (options?: GeolocationServiceOptions) =>
    (error: GeolocationPositionError) => {
      dispatch(setLocationError(error.message));

      switch (error.code) {
        case error.PERMISSION_DENIED:
          dispatch(setPermissionGranted(false));
          emitStatus('error', options);
          options?.onError?.(error);
          dispatch(setLocationError(permissionDeniedMessage));
          stopWatching();
          break;
        case error.POSITION_UNAVAILABLE:
        case error.TIMEOUT:
        default:
          emitStatus('error', options);
          options?.onError?.(error);
          break;
      }
    };

  const startWatching = (options?: GeolocationServiceOptions) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      dispatch(setPermissionGranted(false));
      dispatch(setLocationError(unsupportedMessage));
      emitStatus('unsupported', options);
      options?.onError?.(new Error(unsupportedMessage));
      return;
    }

    if (state.isWatching) {
      return;
    }

    emitStatus('locating', options);
    dispatch(setLocationError(undefined));

    const watchId = navigator.geolocation.watchPosition(
      handleSuccess(options),
      handleError(options),
      {
        ...defaultOptions,
        ...(options ?? {}),
      },
    );

    state.watchId = watchId;
    state.isWatching = true;
  };

  const reset = () => {
    stopWatching();
    dispatch(resetLocation());
  };

  const getCurrentPosition = (
    options?: PositionOptions,
  ): Promise<Coordinates | undefined> => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return Promise.resolve(undefined);
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        ({ coords, timestamp }) => {
          const coordinates: Coordinates = {
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: coords.accuracy,
            heading:
              'heading' in coords ? (coords as GeolocationCoordinates).heading ?? null : null,
            speed: 'speed' in coords ? (coords as GeolocationCoordinates).speed ?? null : null,
            timestamp,
          };

          resolve(coordinates);
        },
        (error) => {
          reject(error);
        },
        { ...defaultOptions, ...(options ?? {}) },
      );
    });
  };

  return {
    startWatching,
    stopWatching,
    reset,
    getCurrentPosition,
    isWatching: () => state.isWatching,
  };
};

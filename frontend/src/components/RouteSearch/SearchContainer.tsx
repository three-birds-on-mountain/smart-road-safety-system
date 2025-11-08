import { useState, useCallback } from 'react';
import DualSearchBox from './DualSearchBox';
import { useAppSelector } from '../../hooks/store';
import type { GeocodingFeature } from '../../services/mapboxApi';

export interface SearchPoint {
  address: string;
  lat: number;
  lng: number;
}

interface SearchContainerProps {
  onRouteRequest: (origin: SearchPoint, destination: SearchPoint) => void;
  onClear?: () => void;
  isLoading?: boolean;
  error?: string | null;
}

/**
 * 搜尋容器元件
 *
 * 整合路線搜尋流程，支援：
 * - 雙搜尋框模式（手動輸入起點和終點）
 * - 目前位置模式（使用目前位置作為起點）
 * - 起點/終點交換
 * - 路線規劃觸發
 */
const SearchContainer = ({ onRouteRequest, onClear, isLoading = false, error = null }: SearchContainerProps) => {
  const currentLocation = useAppSelector((state) => state.location.current);

  // 使用目前位置作為起點的模式
  const [useCurrentLocation, setUseCurrentLocation] = useState(true);

  // 起點和終點輸入值
  const [originInput, setOriginInput] = useState('');
  const [destinationInput, setDestinationInput] = useState('');

  // 選中的起點和終點
  const [originPoint, setOriginPoint] = useState<SearchPoint | null>(null);
  const [destinationPoint, setDestinationPoint] = useState<SearchPoint | null>(null);

  // 處理起點選擇
  const handleOriginSelect = useCallback((feature: GeocodingFeature) => {
    const point: SearchPoint = {
      address: feature.place_name,
      lat: feature.center[1],
      lng: feature.center[0],
    };
    setOriginPoint(point);
    setOriginInput(feature.place_name);
  }, []);

  // 處理終點選擇
  const handleDestinationSelect = useCallback((feature: GeocodingFeature) => {
    const point: SearchPoint = {
      address: feature.place_name,
      lat: feature.center[1],
      lng: feature.center[0],
    };
    setDestinationPoint(point);
    setDestinationInput(feature.place_name);

    // 當使用目前位置模式且已選擇終點時，自動觸發路線規劃
    if (useCurrentLocation && currentLocation) {
      const origin: SearchPoint = {
        address: '目前位置',
        lat: currentLocation.latitude,
        lng: currentLocation.longitude,
      };
      onRouteRequest(origin, point);
    }
  }, [useCurrentLocation, currentLocation, onRouteRequest]);

  // 處理起點清除
  const handleOriginClear = useCallback(() => {
    setOriginPoint(null);
    setOriginInput('');
    onClear?.();
  }, [onClear]);

  // 處理終點清除
  const handleDestinationClear = useCallback(() => {
    setDestinationPoint(null);
    setDestinationInput('');
    onClear?.();
  }, [onClear]);

  // 處理起點/終點交換
  const handleSwap = useCallback(() => {
    // 交換輸入值
    const tempInput = originInput;
    setOriginInput(destinationInput);
    setDestinationInput(tempInput);

    // 交換座標點
    const tempPoint = originPoint;
    setOriginPoint(destinationPoint);
    setDestinationPoint(tempPoint);

    // 如果兩個點都存在，重新規劃路線
    if (destinationPoint && originPoint) {
      onRouteRequest(destinationPoint, originPoint);
    }
  }, [originInput, destinationInput, originPoint, destinationPoint, onRouteRequest]);

  // 切換為使用目前位置模式
  const handleUseCurrentLocation = useCallback(() => {
    setUseCurrentLocation(true);
    setOriginPoint(null);
    setOriginInput('');

    // 如果已有終點，觸發路線規劃
    if (currentLocation && destinationPoint) {
      const origin: SearchPoint = {
        address: '目前位置',
        lat: currentLocation.latitude,
        lng: currentLocation.longitude,
      };
      onRouteRequest(origin, destinationPoint);
    }
  }, [currentLocation, destinationPoint, onRouteRequest]);

  // 切換為手動輸入模式
  const handleManualInput = useCallback(() => {
    setUseCurrentLocation(false);
  }, []);

  // 手動觸發路線規劃（雙搜尋框模式）
  const handlePlanRoute = useCallback(() => {
    if (!originPoint || !destinationPoint) {
      return;
    }
    onRouteRequest(originPoint, destinationPoint);
  }, [originPoint, destinationPoint, onRouteRequest]);

  // 判斷是否可以規劃路線
  const canPlanRoute = useCurrentLocation
    ? currentLocation && destinationPoint
    : originPoint && destinationPoint;

  return (
    <div className="flex flex-col gap-4">
      {/* 雙搜尋框 */}
      <DualSearchBox
        originValue={originInput}
        destinationValue={destinationInput}
        onOriginSelect={handleOriginSelect}
        onDestinationSelect={handleDestinationSelect}
        onOriginClear={handleOriginClear}
        onDestinationClear={handleDestinationClear}
        onSwap={!useCurrentLocation ? handleSwap : undefined}
        disableOrigin={useCurrentLocation}
        disableDestination={!currentLocation && useCurrentLocation}
        useCurrentLocationAsOrigin={useCurrentLocation}
        onUseCurrentLocation={useCurrentLocation ? handleManualInput : handleUseCurrentLocation}
      />

      {/* 錯誤訊息 */}
      {error && (
        <div className="rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-xs text-danger-700">
          {error}
        </div>
      )}

      {/* 規劃路線按鈕（僅在雙搜尋框模式且未自動觸發時顯示） */}
      {!useCurrentLocation && (
        <button
          type="button"
          onClick={handlePlanRoute}
          disabled={!canPlanRoute || isLoading}
          className="flex items-center justify-center gap-2 rounded-lg bg-primary-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
        >
          {isLoading ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <span>規劃中...</span>
            </>
          ) : (
            <>
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                />
              </svg>
              <span>規劃路線</span>
            </>
          )}
        </button>
      )}

      {/* 載入狀態（目前位置模式） */}
      {useCurrentLocation && isLoading && (
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
          <span>規劃路線中...</span>
        </div>
      )}
    </div>
  );
};

export default SearchContainer;

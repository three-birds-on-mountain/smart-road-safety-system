import SearchInput from './SearchInput';
import type { GeocodingFeature } from '../../services/mapboxApi';

interface DualSearchBoxProps {
  originValue: string;
  destinationValue: string;
  onOriginSelect: (feature: GeocodingFeature) => void;
  onDestinationSelect: (feature: GeocodingFeature) => void;
  onOriginClear?: () => void;
  onDestinationClear?: () => void;
  onSwap?: () => void;
  disableOrigin?: boolean;
  disableDestination?: boolean;
  useCurrentLocationAsOrigin?: boolean;
  onUseCurrentLocation?: () => void;
}

/**
 * 雙搜尋框元件
 *
 * 提供起點和終點的搜尋功能，支援：
 * - 起點/終點輸入
 * - 起點/終點交換
 * - 使用目前位置作為起點
 */
const DualSearchBox = ({
  originValue,
  destinationValue,
  onOriginSelect,
  onDestinationSelect,
  onOriginClear,
  onDestinationClear,
  onSwap,
  disableOrigin = false,
  disableDestination = false,
  useCurrentLocationAsOrigin = false,
  onUseCurrentLocation,
}: DualSearchBoxProps) => {

  const handleSwap = () => {
    if (onSwap && !disableOrigin && !disableDestination) {
      onSwap();
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* 起點搜尋框 */}
      <div className="relative">
        <div className="absolute left-3 top-1/2 z-10 flex -translate-y-1/2 flex-col items-center gap-1">
          {/* 起點圖示 */}
          <div className="flex h-3 w-3 items-center justify-center rounded-full bg-primary-500">
            <div className="h-1.5 w-1.5 rounded-full bg-white" />
          </div>
        </div>

        <div className="pl-8">
          {useCurrentLocationAsOrigin ? (
            <div className="flex items-center gap-2 rounded-lg border border-primary-300 bg-primary-50 px-4 py-3">
              <svg className="h-5 w-5 flex-shrink-0 text-primary-500" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="flex-1 text-sm font-medium text-primary-700">目前位置</span>
              {onUseCurrentLocation && (
                <button
                  type="button"
                  onClick={onUseCurrentLocation}
                  className="text-xs text-primary-600 underline hover:text-primary-700"
                >
                  改為手動輸入
                </button>
              )}
            </div>
          ) : (
            <SearchInput
              placeholder="輸入起點地址..."
              value={originValue}
              onSelect={onOriginSelect}
              onClear={onOriginClear}
              disabled={disableOrigin}
            />
          )}
        </div>
      </div>

      {/* 起點/終點交換按鈕 */}
      {onSwap && (
        <div className="relative flex justify-center">
          <button
            type="button"
            onClick={handleSwap}
            disabled={disableOrigin || disableDestination}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-600 transition hover:border-primary-500 hover:text-primary-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="交換起點和終點"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
              />
            </svg>
          </button>
        </div>
      )}

      {/* 終點搜尋框 */}
      <div className="relative">
        <div className="absolute left-3 top-1/2 z-10 -translate-y-1/2">
          {/* 終點圖示 */}
          <div className="flex h-3 w-3 items-center justify-center rounded-full border-2 border-danger-500 bg-white" />
        </div>

        <div className="pl-8">
          <SearchInput
            placeholder="輸入目的地地址..."
            value={destinationValue}
            onSelect={onDestinationSelect}
            onClear={onDestinationClear}
            disabled={disableDestination}
          />
        </div>
      </div>

      {/* 使用目前位置作為起點的選項 */}
      {!useCurrentLocationAsOrigin && onUseCurrentLocation && !originValue && (
        <button
          type="button"
          onClick={onUseCurrentLocation}
          className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm text-gray-600 transition hover:border-primary-500 hover:bg-primary-50 hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <span>使用目前位置作為起點</span>
        </button>
      )}
    </div>
  );
};

export default DualSearchBox;

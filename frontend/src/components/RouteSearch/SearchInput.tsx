import { useState, useRef, useEffect } from 'react';
import { searchAddress, type GeocodingFeature } from '../../services/mapboxApi';
import { useAppSelector } from '../../hooks/store';

interface SearchInputProps {
  placeholder: string;
  value: string;
  onSelect: (feature: GeocodingFeature) => void;
  onClear?: () => void;
  disabled?: boolean;
}

/**
 * 搜尋框元件
 * 提供地址搜尋和自動完成功能
 */
const SearchInput = ({ placeholder, value, onSelect, onClear, disabled = false }: SearchInputProps) => {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<GeocodingFeature[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceTimeout = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentLocation = useAppSelector((state) => state.location.current);

  // 當外部 value 變化時更新內部 query
  useEffect(() => {
    setQuery(value);
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    setError(null);

    // 清除建議
    if (!newQuery.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // 防抖搜尋
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    debounceTimeout.current = setTimeout(async () => {
      setIsLoading(true);
      setError(null);

      try {
        // 如果有目前位置，優先搜尋附近
        const proximity = currentLocation
          ? ([currentLocation.longitude, currentLocation.latitude] as [number, number])
          : undefined;

        const response = await searchAddress(newQuery, {
          limit: 5,
          proximity,
        });

        setSuggestions(response.features);
        setShowSuggestions(response.features.length > 0);
      } catch (err) {
        console.error('搜尋地址失敗:', err);
        setError('搜尋失敗，請稍後再試');
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setIsLoading(false);
      }
    }, 300);
  };

  const handleSelectSuggestion = (feature: GeocodingFeature) => {
    setQuery(feature.place_name);
    setSuggestions([]);
    setShowSuggestions(false);
    onSelect(feature);
  };

  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    setError(null);
    onClear?.();
    inputRef.current?.focus();
  };

  const handleBlur = () => {
    // 延遲隱藏建議，讓點擊事件有時間觸發
    setTimeout(() => {
      setShowSuggestions(false);
    }, 200);
  };

  return (
    <div className="relative w-full">
      {/* 搜尋輸入框 */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 pr-10 text-sm text-text-primary placeholder-text-secondary shadow-sm transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:bg-gray-100 disabled:text-gray-400"
        />

        {/* 載入指示器或清除按鈕 */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
          ) : query ? (
            <button
              type="button"
              onClick={handleClear}
              className="flex h-5 w-5 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              aria-label="清除"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : (
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          )}
        </div>
      </div>

      {/* 錯誤訊息 */}
      {error && (
        <div className="mt-2 text-xs text-danger-500">
          {error}
        </div>
      )}

      {/* 建議列表 */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 mt-2 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
          <ul className="max-h-64 overflow-y-auto">
            {suggestions.map((feature, index) => (
              <li key={feature.id}>
                <button
                  type="button"
                  onClick={() => handleSelectSuggestion(feature)}
                  className={`w-full px-4 py-3 text-left text-sm transition hover:bg-gray-50 ${
                    index !== suggestions.length - 1 ? 'border-b border-gray-100' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <svg
                      className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
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
                    <span className="flex-1 text-text-primary">{feature.place_name}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SearchInput;

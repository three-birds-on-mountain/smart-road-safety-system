import { useState, useRef, useEffect } from 'react';
import type { RouteSafetySummary } from '../../types/route';

interface RouteSummaryProps {
  summary: RouteSafetySummary;
  isVisible: boolean;
  onToggle: () => void;
  onClearRoute: () => void;
}

/**
 * 路線安全統計抽屜元件
 *
 * 顯示路線經過的事故統計和安全建議
 * 支援滑動隱藏/展開
 */
const RouteSummary = ({ summary, isVisible, onToggle, onClearRoute }: RouteSummaryProps) => {
  const { totalAccidents, a1Count, a2Count, a3Count, suggestPublicTransport, message } = summary;

  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const startYRef = useRef(0);
  const drawerRef = useRef<HTMLDivElement>(null);

  // 處理觸控開始
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    startYRef.current = e.touches[0].clientY;
  };

  // 處理觸控移動
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;

    const currentY = e.touches[0].clientY;
    const diff = currentY - startYRef.current;

    // 只允許向下拖曳
    if (diff > 0) {
      setDragOffset(diff);
    }
  };

  // 處理觸控結束
  const handleTouchEnd = () => {
    setIsDragging(false);

    // 如果拖曳超過 100px，則隱藏抽屜
    if (dragOffset > 100) {
      onToggle();
    }

    setDragOffset(0);
  };

  // 處理點擊拖曳指示器
  const handleIndicatorClick = () => {
    onToggle();
  };

  // 重置拖曳狀態
  useEffect(() => {
    if (!isVisible) {
      setDragOffset(0);
      setIsDragging(false);
    }
  }, [isVisible]);

  return (
    <div
      ref={drawerRef}
      className="pointer-events-auto fixed bottom-0 left-0 right-0 z-[200] bg-white shadow-2xl transition-transform duration-300 ease-out"
      style={{
        transform: isVisible ? `translateY(${dragOffset}px)` : 'translateY(100%)',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* 拖曳指示器 */}
      <div
        className="flex cursor-pointer justify-center py-3 active:bg-gray-50"
        onClick={handleIndicatorClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleIndicatorClick();
          }
        }}
        aria-label={isVisible ? '隱藏路線統計' : '顯示路線統計'}
      >
        <div className="h-1 w-12 rounded-full bg-gray-300" />
      </div>

      {/* 內容區 */}
      <div className="px-4 pb-6">
        {/* 標題列 */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text-primary">路線安全評估</h3>
          <div className="flex gap-2">
            {/* 隱藏按鈕 */}
            <button
              type="button"
              onClick={onToggle}
              className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              aria-label="隱藏"
              title="隱藏統計"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* 安全建議 */}
        <div
          className={`mb-4 rounded-lg p-4 ${
            suggestPublicTransport
              ? 'bg-warning-50 border border-warning-200'
              : 'bg-success-50 border border-success-200'
          }`}
        >
          <div className="flex items-start gap-3">
            {suggestPublicTransport ? (
              <svg
                className="mt-0.5 h-6 w-6 flex-shrink-0 text-warning-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg
                className="mt-0.5 h-6 w-6 flex-shrink-0 text-success-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            <div className="flex-1">
              <p
                className={`text-sm font-semibold ${
                  suggestPublicTransport ? 'text-warning-800' : 'text-success-800'
                }`}
              >
                {message}
              </p>
              <p className="mt-1 text-xs text-gray-600">
                {suggestPublicTransport
                  ? '此路線經過多個事故熱點，建議考慮其他交通方式'
                  : '此路線相對安全，可以安心出遊'}
              </p>
            </div>
          </div>
        </div>

        {/* 事故統計 */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-text-secondary">經過路段事故統計</h4>

          {/* 總事故數 */}
          <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
            <span className="text-sm text-text-secondary">總事故數</span>
            <span className="text-lg font-semibold text-text-primary">{totalAccidents} 筆</span>
          </div>

          {/* 各等級事故數 */}
          <div className="grid grid-cols-3 gap-2">
            {/* A1 (死亡) */}
            <div className="rounded-lg bg-danger-50 p-3 text-center">
              <div className="text-xs text-danger-600">A1（死亡）</div>
              <div className="mt-1 text-lg font-semibold text-danger-700">{a1Count}</div>
            </div>

            {/* A2 (受傷) */}
            <div className="rounded-lg bg-warning-50 p-3 text-center">
              <div className="text-xs text-warning-600">A2（受傷）</div>
              <div className="mt-1 text-lg font-semibold text-warning-700">{a2Count}</div>
            </div>

            {/* A3 (財損) */}
            <div className="rounded-lg bg-secondary-50 p-3 text-center">
              <div className="text-xs text-secondary-600">A3（財損）</div>
              <div className="mt-1 text-lg font-semibold text-secondary-700">{a3Count}</div>
            </div>
          </div>
        </div>

        {/* 說明文字 */}
        <div className="mt-4 rounded-lg bg-gray-50 p-3">
          <p className="text-xs text-gray-600">
            <span className="font-medium">統計範圍：</span>路線兩側 200 公尺內的事故熱點
          </p>
          <p className="mt-1 text-xs text-gray-600">
            <span className="font-medium">篩選條件：</span>
            依據目前設定的時間範圍、嚴重程度和數量門檻
          </p>
        </div>
      </div>
    </div>
  );
};

export default RouteSummary;

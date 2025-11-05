import type { HotspotSummary } from '../../types/hotspot'
import { getHighestSeverityLevel } from '../../types/hotspot'

export interface HotspotDetailPopupProps {
  /** 熱點資料 */
  hotspot: HotspotSummary
  /** 關閉彈窗的回調 */
  onClose: () => void
}

/**
 * 格式化日期時間字串
 */
const formatDateTime = (dateTimeString?: string): string => {
  if (!dateTimeString) return '未知'

  try {
    const date = new Date(dateTimeString)
    return date.toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  } catch {
    return '未知'
  }
}

/**
 * 根據嚴重程度返回標籤樣式
 */
const getSeverityBadgeClass = (severity: string): string => {
  switch (severity) {
    case 'A1':
      return 'bg-danger-500 text-white'
    case 'A2':
      return 'bg-warning-500 text-white'
    case 'A3':
      return 'bg-secondary-500 text-white'
    default:
      return 'bg-gray-500 text-white'
  }
}

/**
 * 根據嚴重程度返回標籤文字
 */
const getSeverityLabel = (severity: string): string => {
  switch (severity) {
    case 'A1':
      return 'A1 (死亡)'
    case 'A2':
      return 'A2 (重傷)'
    case 'A3':
      return 'A3 (輕傷)'
    default:
      return '未知'
  }
}

/**
 * HotspotDetailPopup 元件
 *
 * 顯示熱點的詳細資訊彈窗，包含：
 * - 事故總數與各等級數量
 * - 最早與最近事故時間
 * - 熱點半徑
 * - 關閉按鈕
 *
 * 使用 Design System 的卡片與間距樣式。
 *
 * @example
 * ```tsx
 * <HotspotDetailPopup
 *   hotspot={selectedHotspot}
 *   onClose={() => setSelectedHotspot(null)}
 * />
 * ```
 */
const HotspotDetailPopup = ({ hotspot, onClose }: HotspotDetailPopupProps) => {
  const severity = getHighestSeverityLevel(hotspot)
  const severityBadgeClass = getSeverityBadgeClass(severity)
  const severityLabel = getSeverityLabel(severity)

  return (
    <div className="rounded-lg bg-white shadow-xl" style={{ minWidth: '280px' }}>
      {/* 標題列 */}
      <div className="flex items-start justify-between border-b border-gray-100 px-md py-sm">
        <div className="flex flex-col gap-xs">
          <h3 className="text-base font-semibold text-text-primary">
            事故熱點詳情
          </h3>
          <span
            className={`self-start rounded-full px-sm py-xs text-xs font-semibold ${severityBadgeClass}`}
          >
            {severityLabel}
          </span>
        </div>
        <button
          onClick={onClose}
          className="ml-sm rounded-md p-xs text-text-secondary transition-colors hover:bg-gray-50 hover:text-text-primary"
          aria-label="關閉"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* 內容 */}
      <div className="flex flex-col gap-md px-md py-md">
        {/* 事故統計 */}
        <div className="flex flex-col gap-sm">
          <h4 className="text-sm font-semibold text-text-primary">事故統計</h4>
          <div className="grid grid-cols-2 gap-sm">
            <div className="rounded-md bg-surface-muted px-sm py-xs">
              <p className="text-xs text-text-secondary">總事故數</p>
              <p className="text-lg font-semibold text-primary-700">
                {hotspot.totalAccidents}
              </p>
            </div>
            <div className="rounded-md bg-surface-muted px-sm py-xs">
              <p className="text-xs text-text-secondary">影響半徑</p>
              <p className="text-lg font-semibold text-primary-700">
                {hotspot.radiusMeters}m
              </p>
            </div>
          </div>

          {/* 各等級事故數 */}
          <div className="flex flex-wrap gap-xs text-xs">
            {hotspot.a1Count > 0 && (
              <span className="rounded-full bg-danger-500/10 px-sm py-xs text-danger-500">
                A1: {hotspot.a1Count}
              </span>
            )}
            {hotspot.a2Count > 0 && (
              <span className="rounded-full bg-warning-500/10 px-sm py-xs text-warning-500">
                A2: {hotspot.a2Count}
              </span>
            )}
            {hotspot.a3Count > 0 && (
              <span className="rounded-full bg-secondary-500/10 px-sm py-xs text-secondary-700">
                A3: {hotspot.a3Count}
              </span>
            )}
          </div>
        </div>

        {/* 時間範圍 */}
        {(hotspot.earliestAccidentAt || hotspot.latestAccidentAt) && (
          <div className="flex flex-col gap-sm">
            <h4 className="text-sm font-semibold text-text-primary">時間範圍</h4>
            <div className="flex flex-col gap-xs text-xs text-text-secondary">
              {hotspot.earliestAccidentAt && (
                <p>
                  <span className="font-semibold">最早：</span>
                  {formatDateTime(hotspot.earliestAccidentAt)}
                </p>
              )}
              {hotspot.latestAccidentAt && (
                <p>
                  <span className="font-semibold">最近：</span>
                  {formatDateTime(hotspot.latestAccidentAt)}
                </p>
              )}
            </div>
          </div>
        )}

        {/* 位置資訊 */}
        <div className="flex flex-col gap-sm">
          <h4 className="text-sm font-semibold text-text-primary">位置座標</h4>
          <div className="rounded-md bg-surface-muted px-sm py-xs text-xs text-text-secondary">
            <p>緯度: {hotspot.centerLatitude.toFixed(6)}</p>
            <p>經度: {hotspot.centerLongitude.toFixed(6)}</p>
          </div>
        </div>
      </div>

      {/* 底部提示 */}
      <div className="border-t border-gray-100 px-md py-sm">
        <p className="text-xs text-text-description">
          點擊地圖上的熱點標記可查看詳細資訊
        </p>
      </div>
    </div>
  )
}

export default HotspotDetailPopup

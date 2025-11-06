import { useMemo } from 'react'
import AlertModeSelector from '../components/Settings/AlertModeSelector'
import AccidentLevelFilter from '../components/Settings/AccidentLevelFilter'
import DistanceSelector from '../components/Settings/DistanceSelector'
import TimeRangeFilter from '../components/Settings/TimeRangeFilter'
import { useAppSelector } from '../hooks/store'
import type { TimeRangeOption } from '../types/settings'

const TIME_RANGE_TEXT: Record<TimeRangeOption, string> = {
  '1Y': '一年內',
  '6M': '半年內',
  '3M': '三個月內',
  '1M': '一個月內',
}

interface SettingsPageProps {
  onClose: () => void
}

/**
 * 設定頁：全屏 Modal 顯示
 * 提供 X 關閉按鈕回到地圖主畫面
 */
const SettingsPage = ({ onClose }: SettingsPageProps) => {
  const settings = useAppSelector((state) => state.settings.current)

  const severitySummary = useMemo(
    () => settings.severityFilter.join(' / '),
    [settings.severityFilter],
  )
  const channelSummary = useMemo(() => {
    if (settings.alertChannels.length === 0) {
      return '僅視覺提示'
    }

    const mapping: Record<string, string> = {
      sound: '音效',
      vibration: '震動',
    }
    return settings.alertChannels
      .map((channel) => mapping[channel] ?? channel)
      .join(' + ')
  }, [settings.alertChannels])

  return (
    <div className="flex h-screen w-screen flex-col overflow-y-auto bg-surface-muted">
      {/* 標題列 + 關閉按鈕 */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-surface-white px-4 py-3 shadow-sm">
        <h1 className="text-xl font-semibold text-primary-700">警示設定</h1>
        <button
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-gray-100 hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
          aria-label="關閉設定"
          type="button"
        >
          {/* X 圖標 */}
          <svg
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </header>

      {/* 設定內容區域 */}
      <div className="flex-1 px-4 py-6">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* 當前設定摘要（手機優先顯示） */}
          <div className="rounded-lg border border-primary-100 bg-primary-50/60 p-4">
            <div className="mb-2 text-sm font-semibold text-primary-700">
              當前設定
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-primary-600 px-3 py-1 text-white">
                {settings.distanceMeters}m
              </span>
              <span className="rounded-full bg-secondary-600 px-3 py-1 text-white">
                {severitySummary}
              </span>
              <span className="rounded-full bg-gray-600 px-3 py-1 text-white">
                {TIME_RANGE_TEXT[settings.timeRange]}
              </span>
              <span className="rounded-full bg-warning-600 px-3 py-1 text-white">
                {channelSummary}
              </span>
            </div>
          </div>

          {/* 設定項目 */}
          <div className="space-y-4">
            <div className="rounded-lg bg-surface-white p-4 shadow-md">
              <DistanceSelector />
            </div>

            <div className="rounded-lg bg-surface-white p-4 shadow-md">
              <AccidentLevelFilter />
            </div>

            <div className="rounded-lg bg-surface-white p-4 shadow-md">
              <TimeRangeFilter />
            </div>

            <div className="rounded-lg bg-surface-white p-4 shadow-md">
              <AlertModeSelector />
            </div>
          </div>

          {/* 提示訊息 */}
          <div className="rounded-lg bg-gray-50 p-3 text-xs text-text-secondary">
            設定會即時生效並自動儲存至裝置
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage

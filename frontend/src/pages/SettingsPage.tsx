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

const SettingsPage = () => {
  const settings = useAppSelector((state) => state.settings.current)

  const severitySummary = useMemo(() => settings.severityFilter.join(' / '), [settings.severityFilter])
  const channelSummary = useMemo(() => {
    if (settings.alertChannels.length === 0) {
      return '僅視覺提示'
    }

    const mapping: Record<string, string> = { sound: '音效', vibration: '震動' }
    return settings.alertChannels.map((channel) => mapping[channel] ?? channel).join(' + ')
  }, [settings.alertChannels])

  return (
    <section className="flex flex-1 flex-col gap-xl">
      <header className="flex flex-col gap-sm">
        <h1 className="text-3xl font-semibold text-primary-700">警示設定</h1>
        <p className="max-w-2xl text-base text-text-secondary">
          客製化提醒距離、事故等級、警示方式與事故時間範圍，打造最符合行車習慣的安全系統。
          變更會即時套用在警示流程上。
        </p>

        <div className="flex flex-wrap items-center gap-sm text-sm">
          <span className="rounded-full bg-primary-50 px-sm py-xs text-primary-700">
            距離：{settings.distanceMeters} 公尺
          </span>
          <span className="rounded-full bg-secondary-50 px-sm py-xs text-secondary-700">
            等級：{severitySummary}
          </span>
          <span className="rounded-full bg-gray-50 px-sm py-xs text-text-secondary">
            時間範圍：{TIME_RANGE_TEXT[settings.timeRange]}
          </span>
          <span className="rounded-full bg-warning-100 px-sm py-xs text-warning-500">
            警示方式：{channelSummary}
          </span>
        </div>
      </header>

      <div className="grid gap-xl lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-xl">
          <div className="rounded-lg bg-surface-white p-lg shadow-md">
            <DistanceSelector />
          </div>

          <div className="rounded-lg bg-surface-white p-lg shadow-md">
            <AccidentLevelFilter />
          </div>

          <div className="rounded-lg bg-surface-white p-lg shadow-md">
            <TimeRangeFilter />
          </div>

          <div className="rounded-lg bg-surface-white p-lg shadow-md">
            <AlertModeSelector />
          </div>
        </div>

        <aside className="flex flex-col gap-md rounded-lg bg-surface-white p-lg shadow-md">
          <h2 className="text-lg font-semibold text-text-primary">設定摘要</h2>
          <p className="text-sm text-text-secondary">
            調整會即時生效並自動儲存至裝置，下次開啟仍會沿用最新偏好設定。
          </p>

          <div className="flex flex-col gap-sm rounded-lg border border-primary-100 bg-primary-50/60 px-md py-md text-sm text-primary-700">
            <span className="font-semibold">提醒概要</span>
            <ul className="list-disc space-y-xs pl-lg">
              <li>距離：{settings.distanceMeters} 公尺</li>
              <li>事故等級：{severitySummary}</li>
              <li>時間範圍：{TIME_RANGE_TEXT[settings.timeRange]}</li>
              <li>提醒方式：{channelSummary}</li>
            </ul>
          </div>

          <p className="text-xs text-text-description">
            提醒：若需清除設定，可於瀏覽器清除網站資料或使用「重置設定」功能（稍後提供）。
          </p>
        </aside>
      </div>
    </section>
  )
}

export default SettingsPage

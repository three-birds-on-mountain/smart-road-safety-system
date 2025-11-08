import { useState } from 'react';
import type { HotspotDetail, HotspotSummary } from '../../types/hotspot';
import { useAppSelector } from '../../hooks/store';
import InfoIcon from '../../assets/info.svg';

type DetailStatus = 'idle' | 'loading' | 'succeeded' | 'failed';

export interface HotspotDetailPopupProps {
  /** 熱點資料 */
  hotspot: HotspotSummary;
  /** 詳細資料 */
  detail?: HotspotDetail;
  /** 詳細資料載入狀態 */
  detailStatus: DetailStatus;
  detailError?: string;
  /** 開啟完整詳情頁 */
  onShowFullDetail: () => void;
  /** 關閉彈窗的回調 */
  onClose: () => void;
}

/**
 * 格式化日期時間字串
 */
const formatDateTime = (dateTimeString?: string): string => {
  if (!dateTimeString) return '未知';

  try {
    const date = new Date(dateTimeString);
    return date.toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return '未知';
  }
};

/**
 * 根據嚴重程度返回標籤樣式
 */
const getSeverityBadgeClass = (severity: string): string => {
  switch (severity) {
    case 'A1':
      return 'bg-danger-500 text-white';
    case 'A2':
      return 'bg-warning-500 text-white';
    case 'A3':
      return 'bg-secondary-500 text-white';
    default:
      return 'bg-gray-500 text-white';
  }
};

/**
 * 根據嚴重程度返回標籤文字
 */
const getSeverityLabel = (severity: string): string => {
  switch (severity) {
    case 'A1':
      return 'A1 (死亡)';
    case 'A2':
      return 'A2 (重傷)';
    case 'A3':
      return 'A3 (輕傷)';
    default:
      return '未知';
  }
};

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
const HotspotDetailPopup = ({
  hotspot,
  detail,
  detailStatus,
  detailError,
  onShowFullDetail,
  onClose,
}: HotspotDetailPopupProps) => {
  // 建立所有出現的事故等級陣列（按 A1 A2 A3 順序）
  const severityLabels: Array<{ severity: string; label: string; badgeClass: string }> = [];
  if (hotspot.a1Count > 0) {
    severityLabels.push({
      severity: 'A1',
      label: getSeverityLabel('A1'),
      badgeClass: getSeverityBadgeClass('A1'),
    });
  }
  if (hotspot.a2Count > 0) {
    severityLabels.push({
      severity: 'A2',
      label: getSeverityLabel('A2'),
      badgeClass: getSeverityBadgeClass('A2'),
    });
  }
  if (hotspot.a3Count > 0) {
    severityLabels.push({
      severity: 'A3',
      label: getSeverityLabel('A3'),
      badgeClass: getSeverityBadgeClass('A3'),
    });
  }
  const [showSeverityHint, setShowSeverityHint] = useState(false);

  // 取得當前勾選的嚴重程度篩選器
  const severityFilter = useAppSelector((state) => state.settings.current.severityFilter);

  const toggleSeverityHint = () => {
    setShowSeverityHint((prev) => !prev);
  };

  // 計算根據篩選器過濾後的總事故數
  const filteredTotalAccidents =
    (severityFilter.includes('A1') ? hotspot.a1Count : 0) +
    (severityFilter.includes('A2') ? hotspot.a2Count : 0) +
    (severityFilter.includes('A3') ? hotspot.a3Count : 0);

  const primaryAddress =
    detail?.accidents?.find((item) => item.address)?.address ?? '暫無詳細地址資訊';

  return (
    <div className="rounded-lg bg-white shadow-xl" style={{ minWidth: '280px' }}>
      {/* 標題列 */}
      <div className="flex items-start justify-between border-b border-gray-100 px-md py-sm">
        <div className="flex flex-col gap-xs">
          <h3 className="text-base font-semibold text-text-primary">事故熱點詳情</h3>
          <div className="flex items-center gap-xs">
            {severityLabels.map(({ severity, label, badgeClass }) => (
              <span
                key={severity}
                className={`self-start rounded-full px-sm py-xs text-xs font-semibold ${badgeClass}`}
              >
                {label}
              </span>
            ))}
            <button
              type="button"
              className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-50 text-primary-700 transition hover:bg-primary-100"
              aria-label="事故等級說明"
              onClick={toggleSeverityHint}
            >
              <img src={InfoIcon} alt="" className="h-3 w-3" />
            </button>
          </div>
          {showSeverityHint && (
            <div className="rounded-md border border-primary-100 bg-primary-50 px-sm py-xs text-[11px] text-primary-800 shadow-sm">
              A1：死亡事故｜A2：有人受傷｜A3：財損或輕傷事故
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="ml-sm rounded-md p-xs text-text-secondary transition-colors hover:bg-gray-50 hover:text-text-primary"
          aria-label="關閉"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <p className="text-lg font-semibold text-primary-700">{filteredTotalAccidents}</p>
            </div>
            <div className="rounded-md bg-surface-muted px-sm py-xs">
              <p className="text-xs text-text-secondary">影響半徑</p>
              <p className="text-lg font-semibold text-primary-700">{hotspot.radiusMeters}m</p>
            </div>
          </div>

          {/* 各等級事故數 - 只顯示當前篩選器勾選的嚴重程度 */}
          <div className="flex flex-wrap gap-xs text-xs">
            {severityFilter.includes('A1') && hotspot.a1Count > 0 && (
              <span className="rounded-full bg-danger-500/10 px-sm py-xs text-danger-500">
                A1: {hotspot.a1Count}
              </span>
            )}
            {severityFilter.includes('A2') && hotspot.a2Count > 0 && (
              <span className="rounded-full bg-warning-500/10 px-sm py-xs text-warning-500">
                A2: {hotspot.a2Count}
              </span>
            )}
            {severityFilter.includes('A3') && hotspot.a3Count > 0 && (
              <span className="rounded-full bg-secondary-500/10 px-sm py-xs text-secondary-700">
                A3: {hotspot.a3Count}
              </span>
            )}
          </div>
        </div>

        {/* 時間範圍 */}
        {(detail?.analysisPeriodStart ||
          detail?.analysisPeriodEnd ||
          hotspot.earliestAccidentAt ||
          hotspot.latestAccidentAt) && (
          <div className="flex flex-col gap-sm">
            <h4 className="text-sm font-semibold text-text-primary">日期範圍</h4>
            <div className="flex flex-col gap-xs text-xs text-text-secondary">
              {detail?.analysisPeriodStart ? (
                <p>
                  <span className="font-semibold">最早：</span>
                  {formatDateTime(detail.analysisPeriodStart)}
                </p>
              ) : (
                hotspot.earliestAccidentAt && (
                  <p>
                    <span className="font-semibold">最早：</span>
                    {formatDateTime(hotspot.earliestAccidentAt)}
                  </p>
                )
              )}
              {detail?.analysisPeriodEnd ? (
                <p>
                  <span className="font-semibold">最近：</span>
                  {formatDateTime(detail.analysisPeriodEnd)}
                </p>
              ) : (
                hotspot.latestAccidentAt && (
                  <p>
                    <span className="font-semibold">最近：</span>
                    {formatDateTime(hotspot.latestAccidentAt)}
                  </p>
                )
              )}
            </div>
          </div>
        )}

        {/* 位置資訊 */}
        <div className="flex flex-col gap-sm">
          <h4 className="text-sm font-semibold text-text-primary">事故位置</h4>
          <div className="rounded-md bg-surface-muted px-sm py-xs text-xs text-text-secondary">
            <p>{primaryAddress}</p>
          </div>
        </div>

        {/* 資料載入狀態 */}
        {detailStatus === 'loading' && (
          <div className="flex items-center gap-2 rounded-md bg-primary-50 px-sm py-xs text-xs text-primary-700">
            <svg
              className="h-4 w-4 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 3v3m0 12v3m9-9h-3M6 12H3m15.364-6.364l-2.121 2.121M8.757 17.243l-2.121 2.121m0-13.728l2.121 2.121m8.486 8.486l2.121 2.121"
              />
            </svg>
            <span>載入詳細資料中…</span>
          </div>
        )}

        {detailStatus === 'failed' && detailError && (
          <div className="rounded-md bg-danger-50 px-sm py-xs text-xs text-danger-600">
            無法取得詳細資料：{detailError}
          </div>
        )}

        {detailStatus === 'succeeded' && detail?.accidents?.length === 0 && (
          <div className="rounded-md bg-secondary-50 px-sm py-xs text-xs text-secondary-700">
            近期沒有符合條件的事故紀錄。
          </div>
        )}
      </div>

      {/* 底部操作 */}
      <div className="flex items-center justify-end gap-sm border-t border-gray-100 px-md py-sm">
        <button
          type="button"
          className="rounded-md border border-gray-200 px-md py-sm text-sm font-medium text-text-secondary transition hover:bg-gray-50"
          onClick={onClose}
        >
          關閉
        </button>
        <button
          type="button"
          onClick={onShowFullDetail}
          disabled={detailStatus === 'loading' || detailStatus === 'failed'}
          className="rounded-md bg-primary-600 px-md py-sm text-sm font-semibold text-white shadow-md transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-primary-400"
        >
          查看全部事故詳情
        </button>
      </div>
    </div>
  );
};

export default HotspotDetailPopup;

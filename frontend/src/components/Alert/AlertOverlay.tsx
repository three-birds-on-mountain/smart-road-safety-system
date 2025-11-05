import type { NearbyHotspot } from '../../types/hotspot';
import { getHighestSeverityLevel } from '../../types/hotspot';
import AlertIcon from './AlertIcon';
import type { AccidentSeverity } from '../../types/accident';

interface AlertOverlayProps {
  hotspot: NearbyHotspot;
  distanceMeters: number;
  isMuted?: boolean;
  onDismiss?: () => void;
  onIgnore?: (hotspotId: string) => void;
}

const severityBorder: Record<AccidentSeverity, string> = {
  A1: 'border-danger-500',
  A2: 'border-warning-500',
  A3: 'border-secondary-500',
};

const severityText: Record<AccidentSeverity, string> = {
  A1: 'text-danger-500',
  A2: 'text-warning-500',
  A3: 'text-secondary-600',
};

const severityLabel: Record<AccidentSeverity, string> = {
  A1: '重大事故熱點',
  A2: '中度事故熱點',
  A3: '輕度事故熱點',
};

const formatDistance = (meters: number) => {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} 公里`;
  }
  return `${Math.round(meters)} 公尺`;
};

const AlertOverlay = ({ hotspot, distanceMeters, isMuted, onDismiss, onIgnore }: AlertOverlayProps) => {
  const severity = getHighestSeverityLevel(hotspot);
  const borderClass = severityBorder[severity];
  const textClass = severityText[severity];

  return (
    <aside
      className={[
        'flex w-full max-w-md flex-col gap-md rounded-lg border-2 bg-surface-white p-lg shadow-xl',
        borderClass,
      ].join(' ')}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start justify-between gap-md">
        <div className="flex items-center gap-md">
          <AlertIcon severity={severity} size="md" animated />
          <div>
            <p className={['text-sm font-semibold uppercase tracking-wide', textClass].join(' ')}>
              {severityLabel[severity]}
            </p>
            <h2 className="text-xl font-semibold text-text-primary">
              距離您 {formatDistance(distanceMeters)}
            </h2>
            {isMuted && (
              <p className="text-xs font-medium text-warning-500">
                提醒方式為靜音模式，僅顯示視覺警示
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          className="rounded-md border border-gray-100 p-xs text-text-secondary transition hover:bg-gray-50"
          onClick={onDismiss}
          aria-label="關閉警示"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18" />
            <path d="M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="grid gap-sm text-sm text-text-secondary">
        <p>
          近期事故總數：
          <span className="font-semibold text-text-primary">{hotspot.totalAccidents}</span>
          （A1 {hotspot.a1Count} / A2 {hotspot.a2Count} / A3 {hotspot.a3Count}）
        </p>
        {hotspot.latestAccidentAt && (
          <p className="text-xs text-text-description">
            最近事故時間：{new Date(hotspot.latestAccidentAt).toLocaleString()}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-sm md:flex-row md:items-center md:justify-end">
        <button
          type="button"
          className="rounded-md border border-gray-200 px-md py-sm text-sm font-medium text-text-secondary transition hover:bg-gray-50"
          onClick={() => onIgnore?.(hotspot.id)}
        >
          忽略此熱點
        </button>
        <button
          type="button"
          className="rounded-md bg-primary-600 px-md py-sm text-sm font-semibold text-white shadow-md transition hover:bg-primary-700"
          onClick={onDismiss}
        >
          知道了
        </button>
      </div>
    </aside>
  );
};

export default AlertOverlay;

import type { NearbyHotspot } from '../../types/hotspot';
import { getHighestSeverityLevel } from '../../types/hotspot';
import AlertIcon from './AlertIcon';
import type { AccidentSeverity } from '../../types/accident';
import type { AlertChannel } from '../../types/settings';

interface AlertOverlayProps {
  hotspot: NearbyHotspot;
  distanceMeters: number;
  isMuted?: boolean;
  channels?: AlertChannel[];
  unsupportedChannels?: AlertChannel[];
  reason?: 'ignored' | 'out-of-range' | 'severity-filtered' | 'cooldown' | 'unsupported' | 'channels-disabled';
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

const AlertOverlay = ({
  hotspot,
  distanceMeters,
  onDismiss,
}: AlertOverlayProps) => {
  const severity = getHighestSeverityLevel(hotspot);
  const borderClass = severityBorder[severity];
  const textClass = severityText[severity];

  // 簡化版：只顯示關鍵資訊，3秒後自動消失
  return (
    <aside
      className={[
        'flex items-center gap-3 rounded-lg border-l-4 bg-surface-white/95 px-4 py-3 shadow-lg backdrop-blur-sm',
        borderClass,
      ].join(' ')}
      role="alert"
      aria-live="assertive"
    >
      {/* 圖標 */}
      <AlertIcon severity={severity} size="sm" animated />

      {/* 警示文字 */}
      <div className="flex-1">
        <p className={['text-sm font-semibold', textClass].join(' ')}>
          {severityLabel[severity]}
        </p>
        <p className="text-xs text-text-secondary">
          距離 {formatDistance(distanceMeters)} · {hotspot.totalAccidents} 起事故
        </p>
      </div>

      {/* 關閉按鈕 */}
      <button
        type="button"
        className="flex h-6 w-6 items-center justify-center rounded-full text-text-secondary transition hover:bg-gray-100"
        onClick={onDismiss}
        aria-label="關閉警示"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18" />
          <path d="M6 6l12 12" />
        </svg>
      </button>
    </aside>
  );
};

export default AlertOverlay;

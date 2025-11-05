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

const channelLabel: Record<AlertChannel, string> = {
  sound: '音效提醒',
  vibration: '震動提醒',
};

const formatDistance = (meters: number) => {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} 公里`;
  }
  return `${Math.round(meters)} 公尺`;
};

const ChannelBadge = ({
  label,
  variant = 'active',
}: {
  label: string;
  variant?: 'active' | 'muted';
}) => (
  <span
    className={[
      'rounded-full px-sm py-xxs text-xs font-semibold',
      variant === 'active'
        ? 'bg-primary-100 text-primary-700'
        : 'bg-warning-100 text-warning-600',
    ].join(' ')}
  >
    {label}
  </span>
);

const AlertOverlay = ({
  hotspot,
  distanceMeters,
  isMuted,
  channels = [],
  unsupportedChannels = [],
  reason,
  onDismiss,
  onIgnore,
}: AlertOverlayProps) => {
  const severity = getHighestSeverityLevel(hotspot);
  const borderClass = severityBorder[severity];
  const textClass = severityText[severity];

  const hasActiveChannels = channels.length > 0;
  const showVisualOnly = isMuted || !hasActiveChannels;
  const showUnsupported = unsupportedChannels.length > 0 && !isMuted;

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
          <div className="flex flex-col gap-xxs">
            <p className={['text-sm font-semibold uppercase tracking-wide', textClass].join(' ')}>
              {severityLabel[severity]}
            </p>
            <h2 className="text-xl font-semibold text-text-primary">
              距離您 {formatDistance(distanceMeters)}
            </h2>
            {showVisualOnly && (
              <div className="flex items-center gap-xs rounded-md border border-warning-200 bg-warning-100/60 px-sm py-xxs text-xs font-medium text-warning-600">
                <span aria-hidden>👁️</span>
                <span>目前僅顯示視覺提醒，不會播放音效或震動。</span>
              </div>
            )}
            {showUnsupported && (
              <div className="flex items-center gap-xs rounded-md border border-secondary-300 bg-secondary-50 px-sm py-xxs text-xs text-secondary-700">
                <span aria-hidden>ℹ️</span>
                <span>裝置不支援 {unsupportedChannels.map((channel) => channelLabel[channel]).join('、')}</span>
              </div>
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

      <div className="flex flex-wrap items-center gap-xxs">
        {channels.includes('sound') && <ChannelBadge label="音效提醒" />}
        {channels.includes('vibration') && <ChannelBadge label="震動提醒" />}
        {showVisualOnly && <ChannelBadge label="視覺提醒" variant="muted" />}
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

      {reason === 'cooldown' && (
        <p className="rounded-md bg-secondary-50 px-md py-xs text-xs text-secondary-700">
          近期已提醒過此熱點，將在冷卻時間後再次提醒。
        </p>
      )}

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

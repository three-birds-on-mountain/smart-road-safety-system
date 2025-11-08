import { useMemo } from 'react';
import type { HotspotDetail } from '../../types/hotspot';
import type { AccidentRecord, AccidentSeverity } from '../../types/accident';
import { useAppSelector } from '../../hooks/store';

interface HotspotIncidentListModalProps {
  hotspot: HotspotDetail;
  onClose: () => void;
}

const severityConfig: Record<
  AccidentSeverity,
  { label: string; badgeClass: string; dotClass: string }
> = {
  A1: {
    label: 'A1｜死亡事故',
    badgeClass: 'bg-danger-500 text-white',
    dotClass: 'bg-danger-500',
  },
  A2: {
    label: 'A2｜重傷事故',
    badgeClass: 'bg-warning-500 text-white',
    dotClass: 'bg-warning-500',
  },
  A3: {
    label: 'A3｜輕傷事故',
    badgeClass: 'bg-secondary-500 text-white',
    dotClass: 'bg-secondary-500',
  },
};

const formatDateTime = (value?: string) => {
  if (!value) return '未知時間';
  try {
    const date = new Date(value);
    return date.toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
};

const formatDistance = (distance?: number) => {
  if (distance == null) return '';
  if (distance < 1000) {
    return `${Math.round(distance)} 公尺`;
  }
  return `${(distance / 1000).toFixed(1)} 公里`;
};

const formatInvolved = (people?: string[], vehicles?: string[]) => {
  const combined = [
    ...(people ?? []).filter(Boolean),
    ...(vehicles ?? []).filter(Boolean),
  ];
  if (!combined.length) {
    return '未提供';
  }
  return combined.join('、');
};

const HotspotIncidentListModal = ({ hotspot, onClose }: HotspotIncidentListModalProps) => {
  // 取得當前勾選的嚴重程度篩選器
  const severityFilter = useAppSelector((state) => state.settings.current.severityFilter);

  // 計算根據篩選器過濾後的總事故數
  const filteredTotalAccidents = 
    (severityFilter.includes('A1') ? hotspot.a1Count : 0) +
    (severityFilter.includes('A2') ? hotspot.a2Count : 0) +
    (severityFilter.includes('A3') ? hotspot.a3Count : 0);

  const accidents: AccidentRecord[] = useMemo(
    () => hotspot.accidents ?? [],
    [hotspot.accidents],
  );
  const primaryAddress =
    accidents.find((item) => item.address)?.address ?? '近期事故位置';

  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-surface-white">
      <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3 shadow-sm">
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-text-secondary">
            事故熱點
          </span>
          <h2 className="text-lg font-semibold text-text-primary">{primaryAddress}</h2>
          <p className="text-xs text-text-secondary">
            分析期間：{formatDateTime(hotspot.analysisPeriodStart)} ~{' '}
            {formatDateTime(hotspot.analysisPeriodEnd)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full text-text-secondary transition hover:bg-gray-100 hover:text-text-primary"
          aria-label="關閉事故詳情"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </header>

      <section className="border-b border-gray-100 bg-surface-muted px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-primary-100 px-3 py-1 text-primary-700">
            事故總數 {filteredTotalAccidents}
          </span>
          {severityFilter.includes('A1') && hotspot.a1Count > 0 && (
            <span className="rounded-full bg-danger-50 px-3 py-1 text-danger-600">
              A1 {hotspot.a1Count}
            </span>
          )}
          {severityFilter.includes('A2') && hotspot.a2Count > 0 && (
            <span className="rounded-full bg-warning-50 px-3 py-1 text-warning-600">
              A2 {hotspot.a2Count}
            </span>
          )}
          {severityFilter.includes('A3') && hotspot.a3Count > 0 && (
            <span className="rounded-full bg-secondary-50 px-3 py-1 text-secondary-600">
              A3 {hotspot.a3Count}
            </span>
          )}
          <span className="rounded-full bg-gray-50 px-3 py-1 text-text-secondary">
            影響半徑 {hotspot.radiusMeters}m
          </span>
        </div>
      </section>

      <main className="flex-1 overflow-y-auto bg-surface-white px-4 py-4">
        {accidents.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-text-secondary">
            <svg
              className="h-12 w-12 text-gray-300"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.633 10.5l1.546-4.64A2.25 2.25 0 0110.307 4.5h3.386a2.25 2.25 0 011.995 1.36l1.546 4.64"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 12h15M6 12l1.5 7.5h9L18 12"
              />
            </svg>
            <p className="text-sm">此熱點範圍內尚無符合條件的事故紀錄</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {accidents.map((accident) => {
              const severity = severityConfig[accident.severity];
              return (
                <li
                  key={accident.id}
                  className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm transition hover:border-primary-200"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-semibold text-text-primary">
                        {formatDateTime(accident.occurredAt)}
                      </span>
                      <span className="text-xs text-text-secondary">
                        {accident.address ?? '地址未提供'}
                        {accident.distanceMeters != null && (
                          <span className="ml-1 text-text-description">
                            （距離 {formatDistance(accident.distanceMeters)}）
                          </span>
                        )}
                      </span>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${severity.badgeClass}`}>
                      {severity.label}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-text-secondary">
                    <span className={`h-2.5 w-2.5 rounded-full ${severity.dotClass}`} aria-hidden />
                    <span className="font-semibold text-text-primary">涉入人／車</span>
                    <span>{formatInvolved(accident.involvedPeople, accident.involvedVehicles)}</span>
                  </div>
                  {accident.description && (
                    <p className="mt-3 rounded-md bg-surface-muted px-3 py-2 text-xs text-text-secondary">
                      {accident.description}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
};

export default HotspotIncidentListModal;

import type { AccidentSeverity } from './accident';

export type AlertDistanceOption = 100 | 500 | 1000 | 3000;

export type TimeRangeOption = '1Y' | '6M' | '3M' | '1M';

export type AlertChannel = 'sound' | 'vibration';

export interface AlertSettings {
  distanceMeters: AlertDistanceOption;
  severityFilter: AccidentSeverity[];
  timeRange: TimeRangeOption;
  alertChannels: AlertChannel[];
  ignoredHotspotIds: string[];
  autoSilenceSeconds: number;
}

export type GPSStatus = 'idle' | 'locating' | 'active' | 'error' | 'unsupported';

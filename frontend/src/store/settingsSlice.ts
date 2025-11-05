import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type {
  AlertChannel,
  AlertDistanceOption,
  AlertSettings,
  TimeRangeOption,
} from '../types/settings';
import type { AccidentSeverity } from '../types/accident';

export const SETTINGS_STORAGE_KEY = 'smart-road-safety-settings';

const ALLOWED_DISTANCES: AlertDistanceOption[] = [100, 500, 1000, 3000];
const ALLOWED_SEVERITIES: AccidentSeverity[] = ['A1', 'A2', 'A3'];
const ALLOWED_TIME_RANGES: TimeRangeOption[] = ['1Y', '6M', '3M', '1M'];
const ALLOWED_CHANNELS: AlertChannel[] = ['sound', 'vibration'];

const baseSettings: AlertSettings = {
  distanceMeters: 500,
  severityFilter: ALLOWED_SEVERITIES,
  timeRange: '1Y',
  alertChannels: ['sound'],
  ignoredHotspotIds: [],
  autoSilenceSeconds: 30,
};

const cloneSettings = (settings: AlertSettings): AlertSettings => ({
  ...settings,
  severityFilter: [...settings.severityFilter],
  alertChannels: [...settings.alertChannels],
  ignoredHotspotIds: [...settings.ignoredHotspotIds],
});

export const createDefaultSettings = (): AlertSettings => cloneSettings(baseSettings);

const sanitizeSeverities = (
  value: unknown,
  fallback: AccidentSeverity[],
): AccidentSeverity[] => {
  if (!Array.isArray(value)) {
    return [...fallback];
  }

  const filtered = value.filter((item): item is AccidentSeverity =>
    ALLOWED_SEVERITIES.includes(item as AccidentSeverity),
  );

  if (filtered.length === 0) {
    return [...fallback];
  }

  return Array.from(new Set(filtered)) as AccidentSeverity[];
};

const sanitizeChannels = (value: unknown, fallback: AlertChannel[]): AlertChannel[] => {
  if (!Array.isArray(value)) {
    return [...fallback];
  }

  const filtered = value.filter((item): item is AlertChannel =>
    ALLOWED_CHANNELS.includes(item as AlertChannel),
  );

  const unique = Array.from(new Set(filtered)) as AlertChannel[];
  return unique;
};

const sanitizeIgnoredHotspots = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(
    new Set(
      value.filter((item): item is string => typeof item === 'string' && item.length > 0),
    ),
  );
};

const clampAutoSilence = (value: unknown, fallback: number): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback;
  }

  const normalized = Math.round(value);
  const clamped = Math.min(Math.max(normalized, 10), 180);
  return clamped;
};

const sanitizeSettings = (
  candidate: Partial<AlertSettings> | null | undefined,
  fallback: AlertSettings,
): AlertSettings => {
  const result = cloneSettings(fallback);

  if (
    candidate?.distanceMeters &&
    ALLOWED_DISTANCES.includes(candidate.distanceMeters as AlertDistanceOption)
  ) {
    result.distanceMeters = candidate.distanceMeters as AlertDistanceOption;
  }

  if (candidate?.timeRange && ALLOWED_TIME_RANGES.includes(candidate.timeRange as TimeRangeOption)) {
    result.timeRange = candidate.timeRange as TimeRangeOption;
  }

  result.severityFilter = sanitizeSeverities(candidate?.severityFilter, result.severityFilter);
  result.alertChannels = sanitizeChannels(candidate?.alertChannels, result.alertChannels);
  result.ignoredHotspotIds = sanitizeIgnoredHotspots(candidate?.ignoredHotspotIds);
  result.autoSilenceSeconds = clampAutoSilence(
    candidate?.autoSilenceSeconds,
    result.autoSilenceSeconds,
  );

  return result;
};

export const loadSettingsFromStorage = (): AlertSettings | undefined => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return undefined;
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return undefined;
    }

    const parsed = JSON.parse(raw) as Partial<AlertSettings>;
    return sanitizeSettings(parsed, createDefaultSettings());
  } catch {
    return undefined;
  }
};

interface SettingsState {
  current: AlertSettings;
}

const initialState: SettingsState = {
  current: createDefaultSettings(),
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    updateDistance(state, action: PayloadAction<AlertDistanceOption>) {
      state.current = sanitizeSettings(
        { distanceMeters: action.payload },
        state.current,
      );
    },
    updateSeverityFilter(state, action: PayloadAction<AccidentSeverity[]>) {
      state.current = sanitizeSettings(
        { severityFilter: action.payload },
        state.current,
      );
    },
    updateTimeRange(state, action: PayloadAction<TimeRangeOption>) {
      state.current = sanitizeSettings({ timeRange: action.payload }, state.current);
    },
    updateAlertChannels(state, action: PayloadAction<AlertChannel[]>) {
      state.current = sanitizeSettings(
        { alertChannels: action.payload },
        state.current,
      );
    },
    toggleIgnoredHotspot(state, action: PayloadAction<string>) {
      const hotspotId = action.payload;
      const exists = state.current.ignoredHotspotIds.includes(hotspotId);
      const nextList = exists
        ? state.current.ignoredHotspotIds.filter((id) => id !== hotspotId)
        : [...state.current.ignoredHotspotIds, hotspotId];

      state.current = sanitizeSettings(
        { ignoredHotspotIds: nextList },
        state.current,
      );
    },
    updateAutoSilence(state, action: PayloadAction<number>) {
      state.current = sanitizeSettings(
        { autoSilenceSeconds: action.payload },
        state.current,
      );
    },
    hydrateSettings(state, action: PayloadAction<AlertSettings>) {
      state.current = sanitizeSettings(action.payload, createDefaultSettings());
    },
    resetSettings(state) {
      state.current = createDefaultSettings();
    },
  },
});

export const sanitizeAlertSettings = (
  candidate: Partial<AlertSettings> | null | undefined,
  fallback: AlertSettings = createDefaultSettings(),
): AlertSettings => sanitizeSettings(candidate, fallback);

export const {
  updateDistance,
  updateSeverityFilter,
  updateTimeRange,
  updateAlertChannels,
  toggleIgnoredHotspot,
  updateAutoSilence,
  hydrateSettings,
  resetSettings,
} = settingsSlice.actions;

export default settingsSlice.reducer;

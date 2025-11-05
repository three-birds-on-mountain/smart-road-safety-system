import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type {
  AlertChannel,
  AlertDistanceOption,
  AlertSettings,
  TimeRangeOption,
} from '../types/settings';
import type { AccidentSeverity } from '../types/accident';

const defaultSettings: AlertSettings = {
  distanceMeters: 500,
  severityFilter: ['A1', 'A2', 'A3'],
  timeRange: '1Y',
  alertChannels: ['sound'],
  ignoredHotspotIds: [],
  autoSilenceSeconds: 30,
};

interface SettingsState {
  current: AlertSettings;
}

const initialState: SettingsState = {
  current: defaultSettings,
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    updateDistance(state, action: PayloadAction<AlertDistanceOption>) {
      state.current.distanceMeters = action.payload;
    },
    updateSeverityFilter(state, action: PayloadAction<AccidentSeverity[]>) {
      state.current.severityFilter = action.payload;
    },
    updateTimeRange(state, action: PayloadAction<TimeRangeOption>) {
      state.current.timeRange = action.payload;
    },
    updateAlertChannels(state, action: PayloadAction<AlertChannel[]>) {
      state.current.alertChannels = action.payload;
    },
    toggleIgnoredHotspot(state, action: PayloadAction<string>) {
      const hotspotId = action.payload;
      const exists = state.current.ignoredHotspotIds.includes(hotspotId);
      state.current.ignoredHotspotIds = exists
        ? state.current.ignoredHotspotIds.filter((id) => id !== hotspotId)
        : [...state.current.ignoredHotspotIds, hotspotId];
    },
    updateAutoSilence(state, action: PayloadAction<number>) {
      state.current.autoSilenceSeconds = action.payload;
    },
    resetSettings(state) {
      state.current = defaultSettings;
    },
  },
});

export const {
  updateDistance,
  updateSeverityFilter,
  updateTimeRange,
  updateAlertChannels,
  toggleIgnoredHotspot,
  updateAutoSilence,
  resetSettings,
} = settingsSlice.actions;

export default settingsSlice.reducer;

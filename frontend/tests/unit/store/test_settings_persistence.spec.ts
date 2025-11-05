import { describe, expect, it } from 'vitest';
import { createAppStore, SETTINGS_STORAGE_KEY } from '../../../src/store';
import {
  updateAlertChannels,
  updateDistance,
  updateTimeRange,
} from '../../../src/store/settingsSlice';

describe('settings persistence', () => {
  it('hydrates state from localStorage when available', () => {
    window.localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        distanceMeters: 1000,
        severityFilter: ['A1', 'A2'],
        timeRange: '3M',
        alertChannels: [],
        ignoredHotspotIds: ['ht-1'],
        autoSilenceSeconds: 45,
      }),
    );

    const store = createAppStore();
    const settings = store.getState().settings.current;

    expect(settings.distanceMeters).toBe(1000);
    expect(settings.timeRange).toBe('3M');
    expect(settings.alertChannels).toEqual([]);
    expect(settings.ignoredHotspotIds).toEqual(['ht-1']);
  });

  it('falls back to defaults when storage data is invalid', () => {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, '{bad json}');
    const store = createAppStore();
    expect(store.getState().settings.current.distanceMeters).toBe(500);
  });

  it('persists changes to localStorage immediately', () => {
    const store = createAppStore();
    store.dispatch(updateDistance(1000));
    store.dispatch(updateTimeRange('3M'));
    store.dispatch(updateAlertChannels([]));

    const stored = JSON.parse(
      window.localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}',
    );

    expect(stored.distanceMeters).toBe(1000);
    expect(stored.timeRange).toBe('3M');
    expect(Array.isArray(stored.alertChannels)).toBe(true);
    expect(stored.alertChannels.length).toBe(0);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAlertService } from '../../src/services/alerts';
import type { Coordinates } from '../../src/store/locationSlice';
import type { AlertSettings } from '../../src/types/settings';
import type { NearbyHotspot } from '../../src/types/hotspot';

const baseSettings: AlertSettings = {
  distanceMeters: 500,
  severityFilter: ['A1', 'A2', 'A3'],
  timeRange: '1Y',
  alertChannels: ['sound'],
  ignoredHotspotIds: [],
  autoSilenceSeconds: 30,
};

const createHotspot = (overrides?: Partial<NearbyHotspot>): NearbyHotspot => ({
  id: 'hotspot-001',
  centerLatitude: 25.033,
  centerLongitude: 121.565,
  radiusMeters: 200,
  totalAccidents: 8,
  a1Count: 1,
  a2Count: 5,
  a3Count: 2,
  earliestAccidentAt: '2024-06-01T02:00:00Z',
  latestAccidentAt: '2024-10-01T02:00:00Z',
  severityScore: 7.5,
  distanceFromUserMeters: 150,
  ...overrides,
});

const userLocation: Coordinates = {
  latitude: 25.033,
  longitude: 121.565,
  timestamp: Date.now(),
  accuracy: 5,
};

describe('AlertService', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('triggers alert when hotspot within range and severity allowed', () => {
    const service = createAlertService();
    const hotspot = createHotspot();

    const result = service.triggerAlert({
      hotspot,
      userLocation,
      settings: baseSettings,
    });

    expect(result.triggered).toBe(true);
    expect(result.distanceMeters).toBe(150);
    expect(result.reason).toBeUndefined();
  });

  it('does not trigger when hotspot is ignored', () => {
    const service = createAlertService();
    const hotspot = createHotspot();

    const result = service.triggerAlert({
      hotspot,
      userLocation,
      settings: {
        ...baseSettings,
        ignoredHotspotIds: [hotspot.id],
      },
    });

    expect(result.triggered).toBe(false);
    expect(result.reason).toBe('ignored');
  });

  it('filters out hotspots that do not match severity preference', () => {
    const service = createAlertService();
    const hotspot = createHotspot({ a1Count: 0, a2Count: 3, a3Count: 1 });

    const result = service.triggerAlert({
      hotspot,
      userLocation,
      settings: {
        ...baseSettings,
        severityFilter: ['A1'],
      },
    });

    expect(result.triggered).toBe(false);
    expect(result.reason).toBe('severity-filtered');
  });

  it('enforces cooldown window between alerts for the same hotspot', () => {
    vi.useFakeTimers();
    const service = createAlertService({ minIntervalMs: 60_000 });
    const hotspot = createHotspot();

    // First trigger should succeed.
    const firstResult = service.triggerAlert({
      hotspot,
      userLocation,
      settings: baseSettings,
    });
    expect(firstResult.triggered).toBe(true);

    // Advance time by 30 seconds - still within cooldown.
    vi.advanceTimersByTime(30_000);
    const secondResult = service.triggerAlert({
      hotspot,
      userLocation,
      settings: baseSettings,
    });
    expect(secondResult.triggered).toBe(false);
    expect(secondResult.reason).toBe('cooldown');

    // Advance past cooldown window to allow triggering again.
    vi.advanceTimersByTime(30_000);
    const thirdResult = service.triggerAlert({
      hotspot,
      userLocation,
      settings: baseSettings,
    });
    expect(thirdResult.triggered).toBe(true);
  });

  it('marks alerts as muted when all channels are disabled', () => {
    const service = createAlertService();
    const hotspot = createHotspot();

    const result = service.triggerAlert({
      hotspot,
      userLocation,
      settings: {
        ...baseSettings,
        alertChannels: [],
      },
    });

    expect(result.triggered).toBe(true);
    expect(result.reason).toBe('channels-disabled');
  });
});

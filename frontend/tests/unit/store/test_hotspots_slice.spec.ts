import { describe, expect, it, vi, afterEach } from 'vitest';
import { fetchNearbyHotspots } from '../../../src/store/hotspotsSlice';
import { createAppStore } from '../../../src/store';
import { apiClient } from '../../../src/services/api';

describe('hotspotsSlice', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('includes settings parameters when fetching nearby hotspots', async () => {
    const apiSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: {
        data: [],
        meta: {
          total_count: 0,
        },
      },
    });

    const store = createAppStore({
      settings: {
        current: {
          distanceMeters: 1000,
          severityFilter: ['A1', 'A2'],
          timeRange: '3M',
          alertChannels: ['sound'],
          ignoredHotspotIds: [],
          autoSilenceSeconds: 30,
        },
      },
    });

    await store.dispatch(
      fetchNearbyHotspots({ latitude: 25.033, longitude: 121.565 }),
    );

    expect(apiSpy).toHaveBeenCalledTimes(1);
    const params = apiSpy.mock.calls[0][1]?.params as URLSearchParams;
    expect(params.get('distance')).toBe('1000');
    expect(params.get('severity_levels')).toBe('A1,A2');
    expect(params.get('time_range')).toBe('3_months');
  });
});

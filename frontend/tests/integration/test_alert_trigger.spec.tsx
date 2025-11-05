import { cleanup, render, screen, waitFor } from '@testing-library/react';
import React, { act } from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MapPage from '../../src/pages/MapPage';
import hotspotsReducer from '../../src/store/hotspotsSlice';
import locationReducer from '../../src/store/locationSlice';
import settingsReducer from '../../src/store/settingsSlice';
import { apiClient } from '../../src/services/api';

const createTestStore = () =>
  configureStore({
    reducer: {
      hotspots: hotspotsReducer,
      location: locationReducer,
      settings: settingsReducer,
    },
  });

const renderWithStore = () => {
  const store = createTestStore();
  render(
    <Provider store={store}>
      <MapPage />
    </Provider>,
  );
  return store;
};

const createPosition = (latitude: number, longitude: number): GeolocationPosition =>
  ({
    coords: {
      latitude,
      altitude: null,
      accuracy: 5,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      longitude,
    },
    timestamp: Date.now(),
  }) as GeolocationPosition;

describe('[US1] MapPage alert integration', () => {
  let watchSuccess: ((position: GeolocationPosition) => void) | null = null;

  beforeEach(() => {
    const watchPositionMock = vi.fn<
      [PositionCallback, PositionErrorCallback?, PositionOptions?],
      number
    >((success) => {
      watchSuccess = success;
      return 1;
    });

    const clearWatchMock = vi.fn();

    Object.defineProperty(global.navigator, 'geolocation', {
      configurable: true,
      value: {
        watchPosition: watchPositionMock,
        clearWatch: clearWatchMock,
      },
    });

    Object.defineProperty(global.navigator, 'vibrate', {
      configurable: true,
      value: vi.fn(),
    });

    class MockAudio {
      public loop = false;
      public currentTime = 0;
      play = vi.fn().mockResolvedValue(undefined);
      pause = vi.fn();
    }

    vi.stubGlobal('Audio', MockAudio);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    watchSuccess = null;
  });

  it('displays alert overlay when location enters nearby hotspot', async () => {
    const apiSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: {
        data: [
          {
            id: 'hotspot-001',
            center_latitude: 25.0342,
            center_longitude: 121.5661,
            radius_meters: 250,
            total_accidents: 12,
            a1_count: 2,
            a2_count: 7,
            a3_count: 3,
            earliest_accident_at: '2024-06-01T00:00:00Z',
            latest_accident_at: '2024-10-01T00:00:00Z',
            severity_score: 8.5,
            distance_from_user_meters: 180,
          },
        ],
        meta: {
          total_count: 1,
          query_radius_meters: 500,
          user_location: {
            latitude: 25.033,
            longitude: 121.565,
          },
        },
      },
    });

    renderWithStore();

    await waitFor(() => expect(watchSuccess).toBeTypeOf('function'));
    expect(apiSpy).not.toHaveBeenCalled();

    await act(async () => {
      watchSuccess?.(createPosition(25.033, 121.565));
    });

    await waitFor(() => expect(apiSpy).toHaveBeenCalledTimes(1));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('重大事故熱點');
    expect(alert).toHaveTextContent('距離您 180 公尺');
    expect(alert).toHaveTextContent('近期事故總數');
  });

  it('hides alert overlay when no nearby hotspots remain', async () => {
    const apiSpy = vi.spyOn(apiClient, 'get')
      .mockResolvedValueOnce({
        data: {
          data: [
            {
              id: 'hotspot-001',
              center_latitude: 25.0342,
              center_longitude: 121.5661,
              radius_meters: 250,
              total_accidents: 12,
              a1_count: 2,
              a2_count: 7,
              a3_count: 3,
              earliest_accident_at: '2024-06-01T00:00:00Z',
              latest_accident_at: '2024-10-01T00:00:00Z',
              severity_score: 8.5,
              distance_from_user_meters: 180,
            },
          ],
          meta: {
            total_count: 1,
            query_radius_meters: 500,
            user_location: {
              latitude: 25.033,
              longitude: 121.565,
            },
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [],
          meta: {
            total_count: 0,
            query_radius_meters: 500,
            user_location: {
              latitude: 25.04,
              longitude: 121.57,
            },
          },
        },
      });

    renderWithStore();

    await waitFor(() => expect(watchSuccess).toBeTypeOf('function'));
    expect(apiSpy).not.toHaveBeenCalled();

    await act(async () => {
      watchSuccess?.(createPosition(25.033, 121.565));
    });
    const alert = await screen.findByRole('alert');
    expect(alert).toBeInTheDocument();

    await act(async () => {
      watchSuccess?.(createPosition(25.05, 121.58));
    });

    await waitFor(() => expect(apiSpy).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });
});

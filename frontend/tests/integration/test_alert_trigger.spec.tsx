import { cleanup, render, screen, act } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MapPage from '../../src/pages/MapPage';
import hotspotsReducer, { setNearbyHotspots } from '../../src/store/hotspotsSlice';
import locationReducer, { setGPSStatus, updateLocation } from '../../src/store/locationSlice';
import settingsReducer from '../../src/store/settingsSlice';

vi.mock('../../src/services/flutterBridge', () => ({
  isFlutterBridgeAvailable: vi.fn(() => false),
  requestLocation: vi.fn(),
  postMessage: vi.fn(),
  sendNotification: vi.fn(),
}));

vi.mock('../../src/services/geolocation', () => ({
  createGeolocationService: () => ({
    startWatching: vi.fn(),
    stopWatching: vi.fn(),
    reset: vi.fn(),
    getCurrentPosition: vi.fn(),
    isWatching: () => false,
  }),
}));

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

const mockHotspot = {
  id: 'hotspot-001',
  centerLatitude: 25.0342,
  centerLongitude: 121.5661,
  radiusMeters: 250,
  totalAccidents: 12,
  a1Count: 2,
  a2Count: 7,
  a3Count: 3,
  earliestAccidentAt: '2024-06-01T00:00:00Z',
  latestAccidentAt: '2024-10-01T00:00:00Z',
  severityScore: 8.5,
  distanceFromUserMeters: 180,
};

describe('[US1] MapPage alert integration', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('displays alert overlay when location enters nearby hotspot', async () => {
    const store = renderWithStore();

    await act(async () => {
      store.dispatch(setGPSStatus('active'));
      store.dispatch(
        updateLocation({
          latitude: 25.033,
          longitude: 121.565,
          accuracy: 5,
          timestamp: Date.now(),
        }),
      );
      store.dispatch(setNearbyHotspots([mockHotspot]));
    });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('重大事故熱點');
    expect(alert).toHaveTextContent(/距離 .* 公尺/);
    expect(alert).toHaveTextContent('12 起事故');
  });

  it('hides alert overlay when no nearby hotspots remain', async () => {
    const store = renderWithStore();

    await act(async () => {
      store.dispatch(setGPSStatus('active'));
      store.dispatch(
        updateLocation({
          latitude: 25.033,
          longitude: 121.565,
          accuracy: 5,
          timestamp: Date.now(),
        }),
      );
      store.dispatch(setNearbyHotspots([mockHotspot]));
    });

    await screen.findByRole('alert');

    await act(async () => {
      store.dispatch(setNearbyHotspots([]));
    });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

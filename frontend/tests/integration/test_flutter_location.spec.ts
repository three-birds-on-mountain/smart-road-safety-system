import { waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createAppStore } from '../../src/store';
import { createGeolocationService } from '../../src/services/geolocation';
import type { BridgePosition } from '../../src/services/flutterBridge';

const subscribeContext: { locationHandler?: (payload: BridgePosition) => void } = {};

vi.mock('../../src/services/flutterBridge', () => ({
  isFlutterBridgeAvailable: vi.fn(() => true),
  requestLocation: vi.fn(() =>
    Promise.resolve({
      latitude: 25.04,
      longitude: 121.56,
      accuracy: 8,
    }),
  ),
  postMessage: vi.fn(),
  subscribeToBridgeEvent: vi.fn((eventName: string, handler: (payload: unknown) => void) => {
    if (eventName === 'location') {
      subscribeContext.locationHandler = handler as (payload: BridgePosition) => void;
    }
    return () => null;
  }),
}));

describe('geolocation service (Flutter bridge)', () => {
  it('updates store when bridge publishes location', async () => {
    const store = createAppStore();
    const service = createGeolocationService(store.dispatch);

    service.startWatching();
    await waitFor(() => {
      expect(store.getState().location.current).toBeDefined();
    });

    const locationHandler = subscribeContext.locationHandler;
    expect(locationHandler).toBeDefined();
    locationHandler?.({
      latitude: 25.05,
      longitude: 121.57,
      accuracy: 5,
    });

    expect(store.getState().location.current).toMatchObject({
      latitude: 25.05,
      longitude: 121.57,
    });
  });
});

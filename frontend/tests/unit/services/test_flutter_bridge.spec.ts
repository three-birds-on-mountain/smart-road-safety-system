import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isFlutterBridgeAvailable,
  requestLocation,
  subscribeToBridgeEvent,
} from '../../../src/services/flutterBridge';

describe('flutterBridge service', () => {
  beforeEach(() => {
    delete (window as typeof window & { flutterObject?: unknown }).flutterObject;
    delete (window as typeof window & { flutter_inappwebview?: unknown }).flutter_inappwebview;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('detects availability when flutterObject exists', () => {
    (window as typeof window & { flutterObject?: { postMessage: () => void } }).flutterObject = {
      postMessage: vi.fn(),
    };
    expect(isFlutterBridgeAvailable()).toBe(true);
  });

  it('resolves location requests after receiving bridge response', async () => {
    const postSpy = vi.fn();
    (window as typeof window & { flutterObject?: { postMessage: (payload: string) => void } }).flutterObject =
      {
        postMessage: postSpy,
      };

    const promise = requestLocation();
    const sentPayload = JSON.parse(postSpy.mock.calls[0][0]) as { requestId: string };

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          name: 'location',
          requestId: sentPayload.requestId,
          data: {
            latitude: 25.04,
            longitude: 121.56,
            accuracy: 12,
          },
        },
      }),
    );

    const location = await promise;
    expect(location.latitude).toBe(25.04);
    expect(location.longitude).toBe(121.56);
  });

  it('notifies custom subscribers', () => {
    const handler = vi.fn();
    const unsubscribe = subscribeToBridgeEvent('custom:event', handler);

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          name: 'custom:event',
          data: { foo: 'bar' },
        },
      }),
    );

    expect(handler).toHaveBeenCalledWith({ foo: 'bar' });
    unsubscribe();
  });
});

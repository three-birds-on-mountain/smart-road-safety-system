import type { AlertChannel } from '../types/settings';

export interface FlutterBridgeMessage<TData = unknown> {
  name: string;
  data?: TData;
  requestId?: string;
}

type BridgeHandler = (payload: unknown) => void;

export interface BridgePosition {
  latitude: number;
  longitude: number;
  accuracy?: number;
  heading?: number | null;
  speed?: number | null;
  timestamp?: number;
}

declare global {
  interface Window {
    flutter_inappwebview?: {
      callHandler: (handlerName: string, ...args: unknown[]) => unknown;
    };
    flutterObject?: {
      postMessage: (payload: string) => void;
    };
    ReactNativeWebView?: {
      postMessage: (payload: string) => void;
    };
  }
}

const EVENT_ORIGIN_FLAG = '__bridgeOrigin';
const REQUEST_TIMEOUT_MS = 10_000;
const listeners = new Map<string, Set<BridgeHandler>>();
const pendingLocationRequests = new Map<
  string,
  { resolve: (value: BridgePosition) => void; reject: (error: Error) => void; timeout: number }
>();

const dispatchBridgeEvent = (name: string, payload: unknown) => {
  const handlers = listeners.get(name);
  if (!handlers?.size) {
    return;
  }
  handlers.forEach((handler) => {
    try {
      handler(payload);
    } catch (error) {
      console.error('Bridge handler failed:', error);
    }
  });
};

const handleIncomingMessage = (event: MessageEvent) => {
  const payload = event.data;
  if (!payload || typeof payload !== 'object') {
    return;
  }

  if (payload[EVENT_ORIGIN_FLAG] === 'web') {
    return; // 忽略自行傳送的訊息
  }

  const eventName = payload.name || payload.event;
  if (!eventName) {
    return;
  }

  const detail = payload.data ?? payload.payload ?? payload;
  const requestId = payload.requestId ?? detail?.requestId;

  if (eventName.startsWith('location')) {
    const pendingEntry =
      (requestId && pendingLocationRequests.get(requestId)) ||
      pendingLocationRequests.values().next().value;
    if (pendingEntry) {
      const targetId =
        requestId || [...pendingLocationRequests.entries()].find(([, value]) => value === pendingEntry)?.[0];
      if (targetId) {
        pendingLocationRequests.delete(targetId);
      }
      window.clearTimeout(pendingEntry.timeout);
      pendingEntry.resolve(detail as BridgePosition);
      return;
    }
  }

  dispatchBridgeEvent(eventName, detail);
};

if (typeof window !== 'undefined') {
  window.addEventListener('message', handleIncomingMessage);
}

const sendToFlutter = (message: FlutterBridgeMessage): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  if (typeof window.flutter_inappwebview?.callHandler === 'function') {
    window.flutter_inappwebview.callHandler('postMessage', message);
    return true;
  }

  const serialized = JSON.stringify(message);

  if (typeof window.flutterObject?.postMessage === 'function') {
    window.flutterObject.postMessage(serialized);
    return true;
  }

  if (typeof window.ReactNativeWebView?.postMessage === 'function') {
    window.ReactNativeWebView.postMessage(serialized);
    return true;
  }

  if (typeof window.parent?.postMessage === 'function') {
    window.parent.postMessage({ ...message, [EVENT_ORIGIN_FLAG]: 'web' }, '*');
    return true;
  }

  return false;
};

export const isFlutterBridgeAvailable = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  return Boolean(
    window.flutter_inappwebview?.callHandler ||
      window.flutterObject?.postMessage ||
      window.ReactNativeWebView?.postMessage,
  );
};

export const postMessage = (message: FlutterBridgeMessage): boolean => sendToFlutter(message);

export const subscribeToBridgeEvent = (eventName: string, handler: BridgeHandler): (() => void) => {
  const bucket = listeners.get(eventName) ?? new Set<BridgeHandler>();
  bucket.add(handler);
  listeners.set(eventName, bucket);

  return () => {
    const current = listeners.get(eventName);
    if (!current) return;
    current.delete(handler);
    if (current.size === 0) {
      listeners.delete(eventName);
    }
  };
};

const createRequestId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.round(Math.random() * 10_000)}`;

export const requestLocation = (): Promise<BridgePosition> => {
  if (!isFlutterBridgeAvailable()) {
    return Promise.reject(new Error('Flutter bridge 尚未就緒，無法取得定位資訊'));
  }

  const requestId = createRequestId();

  return new Promise<BridgePosition>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      pendingLocationRequests.delete(requestId);
      reject(new Error('定位請求逾時，請稍後再試'));
    }, REQUEST_TIMEOUT_MS);

    pendingLocationRequests.set(requestId, { resolve, reject, timeout });
    postMessage({ name: 'location:request', data: { requestId }, requestId });
  });
};

export const sendNotification = (
  title: string,
  content: string,
  channels?: AlertChannel[],
): boolean => {
  if (!isFlutterBridgeAvailable()) {
    return false;
  }

  return postMessage({
    name: 'notify',
    data: {
      title,
      content,
      channels,
    },
  });
};

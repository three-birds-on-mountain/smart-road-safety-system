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
      postMessage: (payload: string) => Promise<string>;
      addEventListener: (event: 'message', callback: (event: { data: string }) => void) => void;
      removeEventListener: (event: 'message', callback: (event: { data: string }) => void) => void;
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

const handleIncomingMessage = (event: MessageEvent | { data: string }) => {
  let payload: any;

  // 處理兩種事件格式
  if (typeof event.data === 'string') {
    // flutterObject.addEventListener('message') 格式：data 是 JSON 字串
    try {
      payload = JSON.parse(event.data);
    } catch (error) {
      console.warn('[Flutter Bridge] Failed to parse message:', error);
      return;
    }
  } else {
    // window.addEventListener('message') 格式：data 是物件
    payload = event.data;
  }

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

  if (eventName.startsWith('location') || eventName === 'location') {
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
  // 監聽 window message (舊的方式)
  window.addEventListener('message', handleIncomingMessage);

  // 監聽 flutterObject message (新的方式，與 tpml-seat-tracker 一致)
  if (window.flutterObject?.addEventListener) {
    window.flutterObject.addEventListener('message', handleIncomingMessage as any);
    console.log('[Flutter Bridge] Registered flutterObject message listener');
  }
}

const sendToFlutter = (message: FlutterBridgeMessage): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  const serialized = JSON.stringify(message);

  // 優先使用 flutterObject (與 tpml-seat-tracker 一致)
  if (typeof window.flutterObject?.postMessage === 'function') {
    try {
      window.flutterObject.postMessage(serialized);
      console.log('[Flutter Bridge] Sent message via flutterObject:', message.name);
      return true;
    } catch (error) {
      console.error('[Flutter Bridge] Failed to send via flutterObject:', error);
    }
  }

  if (typeof window.flutter_inappwebview?.callHandler === 'function') {
    window.flutter_inappwebview.callHandler('postMessage', message);
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

export const requestLocation = async (): Promise<BridgePosition> => {
  if (!isFlutterBridgeAvailable()) {
    return Promise.reject(new Error('Flutter bridge 尚未就緒，無法取得定位資訊'));
  }

  // 使用簡單的訊息格式（與 tpml-seat-tracker 一致）
  const requestId = createRequestId();

  return new Promise<BridgePosition>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      pendingLocationRequests.delete(requestId);
      reject(new Error('定位請求逾時，請稍後再試'));
    }, REQUEST_TIMEOUT_MS);

    pendingLocationRequests.set(requestId, { resolve, reject, timeout });

    // 發送簡單的 location 請求（與 tpml-seat-tracker 一致）
    const sent = postMessage({ name: 'location', data: null });
    if (!sent) {
      window.clearTimeout(timeout);
      pendingLocationRequests.delete(requestId);
      reject(new Error('無法發送定位請求'));
    }
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

  // 優先使用新的 FlutterBridge API（雙向通訊）
  if (typeof window.flutterObject?.postMessage === 'function') {
    const bridge = new FlutterBridge();
    bridge.notify(title, content).catch((error) => {
      console.error('發送通知失敗:', error);
    });
    return true;
  }

  // Fallback: 使用舊的單向通訊方式
  return postMessage({
    name: 'notify',
    data: {
      title,
      content,
      channels,
    },
  });
};

/**
 * FlutterBridge 類別 - 提供與 Flutter 雙向通訊的封裝
 * 依照 TownPass WebView Bridge 規範實作
 */
export class FlutterBridge {
  public readonly available: boolean;

  constructor() {
    this.available = typeof window !== 'undefined' && typeof window.flutterObject !== 'undefined';
  }

  /**
   * 通用的 Flutter handler 呼叫方法
   * @param name Handler 名稱
   * @param data 要傳送的資料
   * @returns Promise 回傳 Flutter 的回應資料
   */
  async call<TData = unknown, TResult = unknown>(name: string, data: TData | null = null): Promise<TResult> {
    if (!this.available) {
      throw new Error('Flutter Bridge 不可用');
    }

    const response = await window.flutterObject!.postMessage(
      JSON.stringify({ name, data }),
    );

    const result = JSON.parse(response);
    return result.data as TResult;
  }

  // 便捷方法
  getUserInfo = <T = unknown>() => this.call<null, T>('userinfo');

  getLocation = () => this.call<null, BridgePosition>('location');

  makeCall = (phone: string) => this.call<string, boolean>('phone_call', phone);

  call1999 = () => this.call<null, void>('1999agree');

  openMap = (url: string) => this.call<string, boolean>('launch_map', url);

  getDeviceInfo = <T = unknown>() => this.call<null, T>('deviceinfo');

  scanQR = () => this.call<null, string>('qr_code_scan');

  notify = (title: string, content: string) =>
    this.call<{ title: string; content: string }, void>('notify', { title, content });

  openLink = (url: string) => this.call<string, void>('open_link', url);

  openAppSettings = () => this.call<null, void>('open_app_settings');
}

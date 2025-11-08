# Flutter WebView Bridge 快速參考

## 目錄
- [Web 端 API 參考](#web-端-api-參考)
- [Flutter 端快速實作](#flutter-端快速實作)
- [常用範例程式碼](#常用範例程式碼)

---

## Web 端 API 參考

### 基本語法

```javascript
flutterObject.postMessage(
  JSON.stringify({
    name: 'handler_name',
    data: yourData
  })
).then(response => {
  const result = JSON.parse(response);
  console.log(result.data);
});
```

### 可用的 Handler

| Handler 名稱 | 功能說明 | 輸入資料 | 回傳資料 |
|------------|---------|---------|---------|
| `userinfo` | 取得使用者資訊 | `null` | 使用者物件 |
| `location` | 取得 GPS 定位 | `null` | 位置物件 (`{latitude, longitude, accuracy, ...}`) |
| `phone_call` | 撥打電話 | 電話號碼字串 (e.g. `"0912345678"`) | 布林值 (是否成功) |
| `1999agree` | 撥打 1999 (含使用者同意) | `null` | 無 |
| `launch_map` | 開啟地圖應用 | 地圖 URL 字串 | 布林值 (是否成功) |
| `deviceinfo` | 取得裝置資訊 | `null` | 裝置物件 |
| `qr_code_scan` | 掃描 QR Code | `null` | QR Code 內容字串 |
| `notify` | 顯示系統通知 | `{title: string, content: string}` | 無 |
| `open_link` | 在 App 內開啟連結 | URL 字串 | 無 |

---

## 常用範例程式碼

### Web 端封裝類別

```javascript
class FlutterBridge {
  constructor() {
    this.available = typeof flutterObject !== 'undefined';
  }

  async call(name, data = null) {
    if (!this.available) {
      throw new Error('Flutter Bridge 不可用');
    }

    const response = await flutterObject.postMessage(
      JSON.stringify({ name, data })
    );

    return JSON.parse(response).data;
  }

  // 便捷方法
  getUserInfo = () => this.call('userinfo');
  getLocation = () => this.call('location');
  makeCall = (phone) => this.call('phone_call', phone);
  openMap = (url) => this.call('launch_map', url);
  getDeviceInfo = () => this.call('deviceinfo');
  scanQR = () => this.call('qr_code_scan');
  notify = (title, content) => this.call('notify', { title, content });
  openLink = (url) => this.call('open_link', url);
}

// 使用
const bridge = new FlutterBridge();

// 取得定位
const position = await bridge.getLocation();
console.log(position.latitude, position.longitude);
```

### React Hook 範例

```javascript
import { useState, useEffect } from 'react';

function useFlutterBridge() {
  const [bridge] = useState(() => new FlutterBridge());
  const [isAvailable, setIsAvailable] = useState(false);

  useEffect(() => {
    setIsAvailable(bridge.available);
  }, [bridge]);

  return { bridge, isAvailable };
}

// 元件中使用
function MyComponent() {
  const { bridge, isAvailable } = useFlutterBridge();
  const [location, setLocation] = useState(null);

  const handleGetLocation = async () => {
    try {
      const pos = await bridge.getLocation();
      setLocation(pos);
    } catch (error) {
      console.error('定位失敗:', error);
    }
  };

  if (!isAvailable) {
    return <div>請在 App 中開啟</div>;
  }

  return (
    <button onClick={handleGetLocation}>
      取得定位
    </button>
  );
}
```

### Vue 3 Composable 範例

```javascript
import { ref, onMounted } from 'vue';

export function useFlutterBridge() {
  const bridge = ref(null);
  const isAvailable = ref(false);

  onMounted(() => {
    bridge.value = new FlutterBridge();
    isAvailable.value = bridge.value.available;
  });

  return {
    bridge,
    isAvailable
  };
}

// 元件中使用
<script setup>
import { useFlutterBridge } from './useFlutterBridge';

const { bridge, isAvailable } = useFlutterBridge();

async function getLocation() {
  const position = await bridge.value.getLocation();
  console.log(position);
}
</script>
```

---

## Flutter 端快速實作

### 新增自訂 Handler (3 步驟)

#### 步驟 1: 建立 Handler 類別

```dart
// lib/util/web_message_handler/tp_web_message_handler.dart

class MyCustomHandler extends TPWebMessageHandler {
  @override
  String get name => 'my_custom_feature';

  @override
  Future<void> handle({
    required Object? message,
    required WebUri? sourceOrigin,
    required bool isMainFrame,
    required Function(WebMessage reply)? onReply,
  }) async {
    // 處理邏輯
    final result = await doSomething(message);

    // 回傳結果
    onReply?.call(replyWebMessage(data: result));
  }

  Future<dynamic> doSomething(Object? message) async {
    // 實作你的功能
    return {'success': true};
  }
}
```

#### 步驟 2: 註冊 Handler

```dart
// lib/util/web_message_handler/tp_web_message_listener.dart

abstract class TPWebMessageListener {
  static List<TPWebMessageHandler> get messageHandler => [
        UserinfoWebMessageHandler(),
        LocationMessageHandler(),
        // ... 其他 handlers
        MyCustomHandler(),  // ← 加入這行
      ];
}
```

#### 步驟 3: Web 端呼叫

```javascript
const result = await bridge.call('my_custom_feature', {
  param1: 'value1'
});
```

---

## 常見模式

### 1. 需要權限的功能

```dart
class PermissionRequiredHandler extends TPWebMessageHandler {
  @override
  String get name => 'sensitive_feature';

  @override
  Future<void> handle({...}) async {
    // 1. 檢查權限
    final hasPermission = await checkPermission();

    if (!hasPermission) {
      // 2. 請求權限
      final granted = await requestPermission();

      if (!granted) {
        onReply?.call(replyWebMessage(
          data: {'error': '權限被拒絕'}
        ));
        return;
      }
    }

    // 3. 執行功能
    final result = await performAction();
    onReply?.call(replyWebMessage(data: result));
  }
}
```

### 2. 非同步操作

```dart
class AsyncOperationHandler extends TPWebMessageHandler {
  @override
  String get name => 'async_operation';

  @override
  Future<void> handle({...}) async {
    try {
      // 顯示載入中
      showLoading();

      // 執行耗時操作
      final result = await Future.delayed(
        Duration(seconds: 2),
        () => fetchData(),
      );

      // 隱藏載入中
      hideLoading();

      onReply?.call(replyWebMessage(data: result));
    } catch (error) {
      hideLoading();
      onReply?.call(replyWebMessage(
        data: {'error': error.toString()}
      ));
    }
  }
}
```

### 3. 導航到其他頁面

```dart
class NavigationHandler extends TPWebMessageHandler {
  @override
  String get name => 'navigate';

  @override
  Future<void> handle({...}) async {
    // 導航到其他頁面
    final result = await Get.toNamed('/some-page');

    // 回傳頁面結果
    onReply?.call(replyWebMessage(data: result));
  }
}
```

### 4. 開啟外部應用

```dart
class LaunchAppHandler extends TPWebMessageHandler {
  @override
  String get name => 'launch_app';

  @override
  Future<void> handle({...}) async {
    if (message == null || message is! String) {
      onReply?.call(replyWebMessage(data: false));
      return;
    }

    final Uri uri = Uri.parse(message as String);
    final bool canLaunch = await canLaunchUrl(uri);

    if (canLaunch) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
      onReply?.call(replyWebMessage(data: true));
    } else {
      onReply?.call(replyWebMessage(data: false));
    }
  }
}
```

---

## 除錯技巧

### Flutter 端除錯

```dart
class DebugHandler extends TPWebMessageHandler {
  @override
  Future<void> handle({...}) async {
    print('═══════════════════════════════════════');
    print('Handler: ${this.name}');
    print('Message: $message');
    print('Source: ${sourceOrigin?.toString()}');
    print('IsMainFrame: $isMainFrame');
    print('═══════════════════════════════════════');

    // 處理邏輯...
  }
}
```

### Web 端除錯

```javascript
class DebugFlutterBridge extends FlutterBridge {
  async call(name, data = null) {
    console.group(`🚀 Flutter Bridge: ${name}`);
    console.log('Input:', data);

    try {
      const result = await super.call(name, data);
      console.log('Output:', result);
      console.groupEnd();
      return result;
    } catch (error) {
      console.error('Error:', error);
      console.groupEnd();
      throw error;
    }
  }
}
```

---

## 效能優化

### 快取策略

```javascript
class CachedFlutterBridge extends FlutterBridge {
  constructor() {
    super();
    this.cache = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5 分鐘
  }

  async call(name, data = null, useCache = false) {
    const cacheKey = `${name}:${JSON.stringify(data)}`;

    if (useCache && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTTL) {
        return cached.data;
      }
    }

    const result = await super.call(name, data);

    if (useCache) {
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
    }

    return result;
  }
}

// 使用
const bridge = new CachedFlutterBridge();
const userInfo = await bridge.call('userinfo', null, true); // 使用快取
```

### 批次請求

```javascript
class BatchFlutterBridge extends FlutterBridge {
  async batchCall(requests) {
    return Promise.all(
      requests.map(({ name, data }) => this.call(name, data))
    );
  }
}

// 使用
const bridge = new BatchFlutterBridge();
const [userInfo, deviceInfo, location] = await bridge.batchCall([
  { name: 'userinfo' },
  { name: 'deviceinfo' },
  { name: 'location' }
]);
```

---

## 錯誤處理最佳實踐

### Web 端

```javascript
class SafeFlutterBridge extends FlutterBridge {
  async call(name, data = null, options = {}) {
    const {
      timeout = 10000,
      retries = 3,
      fallback = null
    } = options;

    for (let i = 0; i < retries; i++) {
      try {
        const promise = super.call(name, data);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), timeout)
        );

        return await Promise.race([promise, timeoutPromise]);
      } catch (error) {
        console.warn(`嘗試 ${i + 1}/${retries} 失敗:`, error);

        if (i === retries - 1) {
          console.error('所有重試都失敗了');
          return fallback;
        }

        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }
}
```

### Flutter 端

```dart
class SafeHandler extends TPWebMessageHandler {
  @override
  Future<void> handle({...}) async {
    try {
      // 驗證來源
      if (!isValidOrigin(sourceOrigin)) {
        throw Exception('不受信任的來源');
      }

      // 驗證輸入
      validateInput(message);

      // 執行操作
      final result = await performOperation(message);

      // 回傳結果
      onReply?.call(replyWebMessage(
        data: {'success': true, 'data': result}
      ));
    } on ValidationException catch (e) {
      onReply?.call(replyWebMessage(
        data: {'success': false, 'error': 'validation', 'message': e.toString()}
      ));
    } on PermissionException catch (e) {
      onReply?.call(replyWebMessage(
        data: {'success': false, 'error': 'permission', 'message': e.toString()}
      ));
    } catch (e) {
      onReply?.call(replyWebMessage(
        data: {'success': false, 'error': 'unknown', 'message': e.toString()}
      ));
    }
  }

  bool isValidOrigin(WebUri? origin) {
    final allowedHosts = ['your-domain.com', 'localhost'];
    return origin?.host != null && allowedHosts.contains(origin!.host);
  }

  void validateInput(Object? message) {
    if (message == null) {
      throw ValidationException('訊息不能為空');
    }
    // 其他驗證...
  }
}

class ValidationException implements Exception {
  final String message;
  ValidationException(this.message);
  @override
  String toString() => message;
}

class PermissionException implements Exception {
  final String message;
  PermissionException(this.message);
  @override
  String toString() => message;
}
```

---

## 測試範例

### Flutter 單元測試

```dart
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('MyCustomHandler', () {
    late MyCustomHandler handler;

    setUp(() {
      handler = MyCustomHandler();
    });

    test('應該正確處理有效的訊息', () async {
      dynamic receivedData;

      await handler.handle(
        message: {'test': 'data'},
        sourceOrigin: null,
        isMainFrame: true,
        onReply: (reply) {
          receivedData = jsonDecode(reply.data)['data'];
        },
      );

      expect(receivedData, isNotNull);
      expect(receivedData['success'], true);
    });

    test('應該拒絕無效的訊息', () async {
      dynamic receivedData;

      await handler.handle(
        message: null,
        sourceOrigin: null,
        isMainFrame: true,
        onReply: (reply) {
          receivedData = jsonDecode(reply.data)['data'];
        },
      );

      expect(receivedData, isNull);
    });
  });
}
```

### Web 端測試 (Jest)

```javascript
describe('FlutterBridge', () => {
  let bridge;

  beforeEach(() => {
    // Mock flutterObject
    global.flutterObject = {
      postMessage: jest.fn()
    };

    bridge = new FlutterBridge();
  });

  test('應該成功呼叫 handler', async () => {
    const mockResponse = JSON.stringify({
      name: 'test',
      data: { success: true }
    });

    flutterObject.postMessage.mockResolvedValue(mockResponse);

    const result = await bridge.call('test', { param: 'value' });

    expect(result).toEqual({ success: true });
    expect(flutterObject.postMessage).toHaveBeenCalledWith(
      JSON.stringify({
        name: 'test',
        data: { param: 'value' }
      })
    );
  });
});
```

---

## 參考連結

- [完整使用手冊](./WEBVIEW_BRIDGE_GUIDE.md)
- [flutter_inappwebview 文件](https://inappwebview.dev/)
- 專案檔案:
  - `lib/util/tp_web_view.dart`
  - `lib/util/web_message_handler/`

---

最後更新: 2025-01-08

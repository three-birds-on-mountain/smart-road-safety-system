# 研究文件：背景警示與路線規劃

**功能**: 背景警示與路線規劃
**日期**: 2025-11-08
**相關**: [spec.md](./spec.md) | [plan.md](./plan.md)

## 研究目的

本文件記錄實作智慧道路守護系統背景警示與路線規劃功能所需的技術決策和最佳實踐研究。主要研究領域包括：Web 平台的背景定位追蹤能力、瀏覽器警示 API（震動與音效）、PostGIS 空間查詢最佳化、以及 Mapbox Directions API 整合策略。

## 研究議題

### 1. Web 平台背景定位追蹤

#### 決策：使用前景定位追蹤（Foreground Geolocation），不使用真正的背景追蹤

**選擇原因**:
- **技術限制**: Web 平台（包括 PWA）目前無法在瀏覽器背景執行時取得定位資訊
- **隱私考量**: W3C 和瀏覽器廠商基於隱私保護，拒絕實作 Service Worker 的背景定位 API
- **可行方案**: 前景定位搭配 `watchPosition()` 可在應用程式開啟時持續追蹤位置
- **電池優化**: `watchPosition()` 比重複呼叫 `getCurrentPosition()` 更省電

**實作方式**:

使用 Geolocation API 的 `watchPosition()` 方法：
```javascript
// 啟動位置監看
const watchId = navigator.geolocation.watchPosition(
  (position) => {
    const { latitude, longitude } = position.coords;
    // 檢查是否接近危險路段
    checkNearbyHotspots(latitude, longitude);
  },
  (error) => {
    console.error('定位錯誤:', error);
  },
  {
    enableHighAccuracy: true,  // 高精度模式
    timeout: 10000,            // 10 秒超時
    maximumAge: 5000           // 最多使用 5 秒前的快取位置
  }
);

// 停止監看
navigator.geolocation.clearWatch(watchId);
```

**電池優化最佳實踐**:
- 僅在用戶啟用「路線導航」或「危險提醒」功能時才啟動追蹤
- 使用合理的 `maximumAge` 避免過度頻繁的 GPS 查詢
- 提供手動停止追蹤的選項
- 在低電量時提示用戶並降低追蹤頻率

**替代方案及拒絕原因**:

1. **真正的背景定位追蹤**
   - ❌ Web 平台技術上不可行（瀏覽器背景時無法取得定位）
   - ❌ W3C 已明確拒絕 Service Worker Geolocation API 提案
   - ❌ 即使透過 Service Worker 也只能使用 Background Sync 收集待上傳的定位資料

2. **原生應用包裝（Cordova/Capacitor）**
   - ❌ 需要維護額外的原生應用程式碼
   - ❌ 需要發布到 App Store/Play Store
   - ❌ 增加開發和維護成本
   - ✅ 如果未來需要真正的背景追蹤，可考慮此方案

3. **WebView + 原生背景服務**
   - ❌ 複雜度高
   - ❌ 偏離 Web-first 設計原則
   - ❌ 不適合 MVP 階段

**使用者體驗設計**:
- 明確告知用戶需要保持瀏覽器開啟（可最小化但不能關閉）
- 提供「保持螢幕喚醒」選項（使用 Screen Wake Lock API）
- 在應用程式被背景化時暫停追蹤，返回前景時恢復

**HTTPS 需求**:
- Chrome 50.0+ 後，Geolocation API 僅支援 HTTPS 連線
- HTTP 環境下會拒絕提供定位資訊
- 本地開發時 localhost 視為安全來源

**參考文件**:
- [MDN: Geolocation API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API)
- [W3C Geolocation Specification](https://w3c.github.io/geolocation/)
- [GitHub Issue: Background Geolocation via Service Workers](https://github.com/w3c/geolocation/issues/13)

---

### 2. Web Vibration API 和 Audio API

#### 決策：組合使用 Vibration API（僅 Android）和 Web Audio API（通用）

**選擇原因**:
- **Audio API 支援度高**: 所有現代瀏覽器（Chrome、Firefox、Edge、Safari）都支援
- **Vibration API 有限**: 僅 Android Chrome 完整支援，iOS Safari 不支援
- **漸進增強策略**: 優先使用音效，震動作為 Android 裝置的額外功能
- **低頻寬友善**: Web Audio API 可合成音效，不需下載音檔

**Web Audio API 實作方式**:

警示音效合成（使用 OscillatorNode）：
```javascript
// 播放警示音效
function playAlertSound() {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();

  // 創建振盪器（產生聲音）
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  // 設定頻率（880Hz = A5 音）
  oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
  oscillator.type = 'sine'; // 正弦波，較柔和

  // 設定音量淡出效果
  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

  // 連接節點
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  // 播放 0.5 秒
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.5);
}
```

**Vibration API 實作方式**:

震動模式（僅在支援的裝置上執行）：
```javascript
function vibrateAlert() {
  // 功能偵測
  if ('vibrate' in navigator) {
    // 震動模式: [震動時間, 暫停時間, 震動時間, ...]
    // 200ms 震動, 100ms 暫停, 200ms 震動
    navigator.vibrate([200, 100, 200]);
  }
}

// 組合使用音效和震動
function triggerAlert() {
  playAlertSound();
  vibrateAlert();
}
```

**瀏覽器支援狀態（2025）**:

| API | Chrome | Firefox | Edge | Safari | 支援度 |
|-----|--------|---------|------|--------|--------|
| Web Audio API | ✅ 14+ | ✅ 25+ | ✅ 全版本 | ✅ 全版本（需 webkit 前綴） | 95%+ |
| Vibration API | ✅ Android 30+ | ✅ 11+ | ✅ 79+ | ❌ 不支援 | ~75% |

**功能偵測與降級策略**:
```javascript
// 檢查 Audio API 支援
const AudioContext = window.AudioContext || window.webkitAudioContext;
const isAudioSupported = !!AudioContext;

// 檢查 Vibration API 支援
const isVibrationSupported = 'vibrate' in navigator;

// 根據支援情況選擇警示方式
function showAlert(message) {
  // 1. 視覺警示（所有平台）
  showVisualNotification(message);

  // 2. 音效警示（幾乎所有平台）
  if (isAudioSupported) {
    playAlertSound();
  }

  // 3. 震動警示（僅 Android）
  if (isVibrationSupported) {
    navigator.vibrate([200, 100, 200]);
  }
}
```

**替代方案及拒絕原因**:

1. **使用預錄音檔（MP3/WAV）**
   - ❌ 增加網路頻寬消耗
   - ❌ 需要額外的檔案管理
   - ✅ 音質較好，可考慮作為進階選項

2. **僅使用視覺提示**
   - ❌ 用戶可能錯過警示（未看螢幕）
   - ❌ 安全性較低

3. **使用 Notification API 的震動**
   - ⚠️ 需要用戶授權通知權限
   - ⚠️ 在前景應用時可能不適合

**效能考量**:
- 每次警示時創建新的 AudioContext 可能導致記憶體洩漏
- 建議重用 AudioContext 實例
- 在應用程式關閉時呼叫 `audioContext.close()`

**參考文件**:
- [MDN: Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [MDN: Vibration API](https://developer.mozilla.org/en-US/docs/Web/API/Vibration_API)
- [Can I Use: Web Audio API](https://caniuse.com/audio-api)
- [Can I Use: Vibration API](https://caniuse.com/vibration)

---

### 3. PostGIS 空間查詢最佳化

#### 決策：使用 ST_DWithin + GIST 索引 + 查詢前置過濾

**選擇原因**:
- **效能優異**: ST_DWithin 直接使用空間索引，比 ST_Buffer + ST_Intersects 快 10-100 倍
- **精確度高**: ST_DWithin 計算實際距離，不依賴近似的緩衝區
- **索引友善**: GIST 索引支援所有空間關係運算子
- **查詢簡化**: 單一函式完成距離判斷，程式碼更清晰

**實作方式**:

1. **建立空間索引**:
```sql
-- 建立 GIST 空間索引
CREATE INDEX idx_hotspots_geom ON hotspots USING GIST (geom);

-- 可選：CLUSTER 提升查詢效能
CLUSTER hotspots USING idx_hotspots_geom;
```

2. **查詢路線附近的危險路段**:
```sql
-- 查詢距離路線 200 公尺內的所有危險路段
SELECT
  h.id,
  h.location_name,
  h.severity,
  h.risk_score,
  h.geom,
  ST_Distance(h.geom::geography, route.geom::geography) as distance_meters
FROM hotspots h,
     (SELECT ST_MakeLine(
        ARRAY[
          ST_SetSRID(ST_MakePoint(121.5654, 25.033), 4326),
          ST_SetSRID(ST_MakePoint(121.5234, 25.041), 4326),
          ST_SetSRID(ST_MakePoint(121.5123, 25.048), 4326)
        ]::geometry[]
      ) as geom
     ) as route
WHERE ST_DWithin(
  h.geom::geography,
  route.geom::geography,
  200  -- 200 公尺
)
ORDER BY h.risk_score DESC;
```

3. **使用 && 運算子預過濾（效能優化）**:
```sql
-- 先用邊界框過濾，再用精確距離判斷
SELECT h.id, h.location_name, h.severity
FROM hotspots h, route_geom r
WHERE
  -- 第一階段：邊界框快速過濾（使用索引）
  h.geom && ST_Expand(r.geom, 0.002)  -- 約 200 公尺的度數
  -- 第二階段：精確距離判斷
  AND ST_DWithin(h.geom::geography, r.geom::geography, 200);
```

**GIST vs BRIN 索引選擇**:

| 索引類型 | 適用場景 | 優點 | 缺點 |
|---------|---------|------|------|
| **GIST** | 一般用途，幾何重疊的資料 | 查詢快、支援所有空間運算 | 索引較大、建置較慢 |
| **BRIN** | 超大資料表、空間排序的資料 | 索引極小、建置快 10 倍 | 需要資料物理排序、不支援 kNN |

**本專案選擇 GIST**:
- 危險路段資料量預期 < 10 萬筆（中等規模）
- 資料地理分布隨機，無法保證空間排序
- 需要支援各種空間查詢（距離、相交、包含等）

**路線幾何建立最佳實踐**:
```sql
-- 從 Mapbox Directions API 回傳的座標陣列建立路線
-- coordinates = [[lng1, lat1], [lng2, lat2], ...]
SELECT ST_MakeLine(
  ARRAY(
    SELECT ST_SetSRID(ST_MakePoint(coord[1], coord[2]), 4326)::geography
    FROM unnest($1::float[][]) AS coord
  )
) as route_geom;
```

**替代方案及拒絕原因**:

1. **ST_Buffer + ST_Intersects**
   - ❌ 緩衝區計算成本高
   - ❌ 無法使用原始幾何的索引
   - ❌ 精確度較低（近似多邊形）

2. **ST_Distance < 200**
   - ❌ ST_Distance 不使用索引
   - ❌ 需要計算每一筆資料的距離

3. **BRIN 索引**
   - ❌ 資料無空間排序
   - ❌ 不支援 k-nearest neighbor 查詢
   - ✅ 如果資料量 > 100 萬筆且可空間排序，可考慮

**查詢效能基準**:
- 無索引: ~5000ms（10 萬筆資料）
- GIST 索引: ~50ms（10 萬筆資料）
- GIST + CLUSTER: ~20ms（10 萬筆資料）

**參考文件**:
- [PostGIS: ST_DWithin](https://postgis.net/docs/ST_DWithin.html)
- [PostGIS: Spatial Indexes](https://postgis.net/docs/using_postgis_dbmanagement.html#gist_indexes)
- [Crunchy Data: The Many Spatial Indexes of PostGIS](https://www.crunchydata.com/blog/the-many-spatial-indexes-of-postgis)

---

### 4. Mapbox Directions API 整合

#### 決策：使用 Mapbox Directions API 搭配前端快取和路線簡化

**選擇原因**:
- **完整功能**: 支援路況感知、多種交通模式、路線偏好設定
- **價格合理**: 免費額度 100,000 次請求/月，超過後 $2/1000 次
- **回傳格式友善**: GeoJSON 格式，可直接用於地圖顯示和資料庫儲存
- **導航整合**: 如使用 Mapbox Navigation SDK，導航期間的請求免費

**實作方式**:

1. **API 請求範例**:
```javascript
async function getRoute(waypoints) {
  const coordinates = waypoints
    .map(w => `${w.lng},${w.lat}`)
    .join(';');

  const profile = 'driving-traffic'; // 考慮路況的駕駛路線
  const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordinates}`;

  const params = new URLSearchParams({
    access_token: MAPBOX_TOKEN,
    geometries: 'geojson',        // 回傳 GeoJSON 格式
    overview: 'full',              // 完整路線幾何
    steps: true,                   // 包含導航步驟
    annotations: 'duration,distance' // 包含時間和距離註解
  });

  const response = await fetch(`${url}?${params}`);
  const data = await response.json();

  return data.routes[0]; // 回傳第一條（推薦）路線
}
```

2. **回應格式解析**:
```javascript
{
  "routes": [
    {
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [121.5654, 25.033],
          [121.5655, 25.034],
          // ... 更多座標點
        ]
      },
      "distance": 5234.5,        // 公尺
      "duration": 892.3,         // 秒
      "waypoints": [              // 吸附到路網的路點
        {
          "name": "忠孝東路",
          "location": [121.5654, 25.033]
        }
      ]
    }
  ],
  "waypoints": [                  // 輸入座標吸附後的結果
    {
      "name": "忠孝東路",
      "location": [121.5654, 25.033],
      "distance": 12.3             // 吸附距離（公尺）
    }
  ]
}
```

3. **路線快取策略**:
```javascript
// 使用 IndexedDB 快取路線
async function getCachedRoute(waypoints) {
  const cacheKey = JSON.stringify(waypoints);
  const cached = await db.routes.get(cacheKey);

  // 快取有效期 1 小時
  if (cached && Date.now() - cached.timestamp < 3600000) {
    return cached.route;
  }

  // 快取過期或不存在，請求新路線
  const route = await getRoute(waypoints);

  // 儲存到快取
  await db.routes.put({
    key: cacheKey,
    route: route,
    timestamp: Date.now()
  });

  return route;
}
```

4. **路線簡化（減少資料庫儲存和查詢負擔）**:
```javascript
// 使用 Ramer-Douglas-Peucker 演算法簡化路線
// Turf.js 提供現成的實作
import { simplify } from '@turf/simplify';

function simplifyRoute(route, tolerance = 0.0001) {
  const simplified = simplify(route.geometry, {
    tolerance: tolerance,      // 容許誤差（度）
    highQuality: true
  });

  return {
    ...route,
    geometry: simplified,
    original_points: route.geometry.coordinates.length,
    simplified_points: simplified.coordinates.length
  };
}
```

**API 限制和策略**:

| 限制項目 | 限制值 | 應對策略 |
|---------|--------|---------|
| 每月免費額度 | 100,000 次 | 實作前端快取，相同路線 1 小時內不重複請求 |
| 路點數量上限 | 25 個 | 長路線拆分為多段，或使用中間點精簡 |
| 請求頻率 | 預設限制（未公開） | 實作請求節流（throttle），避免短時間大量請求 |
| 回應大小 | 無明確限制 | 使用 `overview=simplified` 或前端簡化路線 |

**成本估算**:
- 假設每日活躍用戶 100 人，每人規劃 3 條路線
- 每月請求量: 100 × 3 × 30 = 9,000 次（在免費額度內）
- 若超過 100,000 次: 超額部分每 1,000 次 $2（例如 150,000 次 = $100）

**替代方案及拒絕原因**:

1. **Google Maps Directions API**
   - ❌ 價格較高（$5/1000 次，且每月無免費額度）
   - ❌ 需要與 Google Maps 地圖搭配使用（本專案用 Mapbox）

2. **OSRM (Open Source Routing Machine)**
   - ✅ 完全免費，開源
   - ❌ 需要自行架設和維護伺服器
   - ❌ 路況資料需額外整合
   - ✅ 如果成本成為問題，可考慮遷移

3. **MapQuest Directions API**
   - ⚠️ 免費額度較低（15,000 次/月）
   - ⚠️ 路況資料涵蓋範圍較小

**導航模式（profile）選擇**:

| Profile | 適用場景 | 考慮因素 |
|---------|---------|---------|
| `driving-traffic` | 一般駕駛（預設） | 考慮即時路況、事故、道路封閉 |
| `driving` | 駕駛（無路況） | 不考慮路況，速度較快 |
| `walking` | 步行 | 人行道、步行專用道 |
| `cycling` | 自行車 | 自行車道、坡度考量 |

**最佳實踐**:
- 前端請求時加入重試邏輯（網路錯誤、超時）
- 使用 `geometries: 'geojson'` 而非 `polyline` 以便直接用於地圖和資料庫
- 儲存路線時同時儲存 `distance` 和 `duration` 以便後續分析
- 長路線考慮分段請求，避免單次回應過大

**參考文件**:
- [Mapbox Directions API Documentation](https://docs.mapbox.com/api/navigation/directions/)
- [Mapbox Pricing](https://www.mapbox.com/pricing)
- [Turf.js: simplify](https://turfjs.org/docs/#simplify)

---

## 技術堆疊總結

### 前端
- **定位追蹤**: Geolocation API (`watchPosition()`)
- **音效警示**: Web Audio API (OscillatorNode)
- **震動警示**: Vibration API (僅 Android，漸進增強)
- **路線規劃**: Mapbox Directions API
- **路線快取**: IndexedDB
- **地理計算**: Turf.js (路線簡化、距離計算)

### 後端
- **空間資料庫**: PostgreSQL 15 + PostGIS 3.4
- **空間索引**: GIST index
- **距離查詢**: ST_DWithin (geography type)
- **路線儲存**: LineString geometry (SRID 4326)

### API 整合
- **地圖服務**: Mapbox GL JS 3.16
- **路線規劃**: Mapbox Directions API
- **免費額度**: 100,000 次/月
- **超額計費**: $2/1000 次

---

## 架構設計要點

### 1. 前端架構
```
使用者啟動導航
    ↓
啟動 watchPosition() 持續追蹤位置
    ↓
每次位置更新 → 檢查是否接近危險路段
    ↓
是 → 觸發多模態警示（視覺 + 音效 + 震動）
    ↓
否 → 繼續追蹤
```

### 2. 路線規劃流程
```
使用者輸入起點和終點
    ↓
檢查快取（IndexedDB）
    ↓
快取存在且有效 → 使用快取路線
    ↓
快取不存在 → 呼叫 Mapbox Directions API
    ↓
簡化路線（減少點數）
    ↓
儲存到快取
    ↓
查詢路線沿線 200m 內的危險路段（ST_DWithin）
    ↓
在地圖上顯示路線和危險路段
```

### 3. 資料庫查詢最佳化
```
1. 建立 GIST 空間索引（一次性）
2. 使用 ST_DWithin 而非 ST_Buffer
3. 可選：使用 && 運算子預過濾
4. 按風險評分排序結果
```

---

## 風險和緩解策略

### 風險 1: 瀏覽器背景時無法追蹤位置
**可能影響**:
- 用戶切換到其他應用時失去位置追蹤
- 無法在背景提供警示

**緩解策略**:
- UI 明確提示用戶需保持應用在前景
- 提供「保持螢幕喚醒」選項（Wake Lock API）
- 考慮在導航模式下使用全螢幕模式減少誤觸
- 未來如需真正背景追蹤，評估原生應用包裝方案

### 風險 2: iOS 裝置無震動功能
**可能影響**:
- iPhone 用戶無法感受到震動警示

**緩解策略**:
- 多模態警示設計（視覺 + 音效 + 震動）
- 震動視為額外功能，不作為唯一警示方式
- 功能偵測後在 UI 顯示可用的警示模式

### 風險 3: Mapbox API 額度超限
**可能影響**:
- 超過每月 100,000 次免費額度
- 產生預期外的費用

**緩解策略**:
- 實作前端快取（IndexedDB），相同路線 1 小時內不重複請求
- 監控 API 使用量（Mapbox Dashboard）
- 設定用量警報（接近 80% 額度時通知）
- 準備遷移計畫（OSRM 自架方案）

### 風險 4: PostGIS 查詢效能不佳
**可能影響**:
- 路線規劃時查詢危險路段超過 1 秒
- 影響用戶體驗

**緩解策略**:
- 建立 GIST 空間索引（必要）
- 定期執行 CLUSTER 最佳化
- 使用 EXPLAIN ANALYZE 監控查詢計畫
- 考慮前端分段查詢長路線

### 風險 5: GPS 定位不準確
**可能影響**:
- 在隧道、高樓區定位漂移
- 誤報或漏報危險路段

**緩解策略**:
- 使用 `enableHighAccuracy: true` 提高精度
- 設定合理的距離閾值（200m 而非 50m）
- 連續 N 次位置更新都接近危險路段才警示（避免單次誤報）
- 允許用戶手動回報誤報

---

## 效能指標

### 前端效能目標
- 位置更新頻率: 1-5 秒/次（視移動速度調整）
- 警示延遲: < 500ms（從位置更新到警示觸發）
- 路線規劃響應: < 2 秒（含 API 請求）
- 路線快取命中率: > 60%

### 後端效能目標
- 空間查詢響應: < 100ms（10 萬筆危險路段資料）
- 資料庫連線池: 20-50 連線
- API endpoint 響應: < 200ms (p95)

### API 用量目標
- Mapbox Directions API: < 80,000 次/月（避免超額）
- 平均每次導航 API 呼叫: 1-2 次（含重新規劃）

---

## 下一步

研究完成後，將進入實作階段，需完成：

1. **前端開發**:
   - Geolocation service 實作
   - 多模態警示系統（音效 + 震動 + 視覺）
   - Mapbox Directions API 整合
   - IndexedDB 快取層

2. **後端開發**:
   - 路線-危險路段查詢 API endpoint
   - PostGIS 空間索引建立
   - ST_DWithin 查詢最佳化

3. **測試**:
   - 不同瀏覽器的 API 支援測試
   - 空間查詢效能測試
   - 定位追蹤電池消耗測試

4. **文件**:
   - API 規格文件
   - 使用者操作指南
   - 瀏覽器相容性說明

---

**研究完成日期**: 2025-11-08
**研究者**: Claude Code
**版本**: 1.0

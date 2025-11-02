# 技術研究決策：智慧道路守護系統

**日期**: 2025-11-02
**專案**: 001-road-safety-system
**目的**: 解決實作計劃中的技術不確定性

---

## 1. 地理聚類演算法選擇

### 決策
選擇 **scikit-learn 的 DBSCAN**

### 理由
1. **成熟穩定**: scikit-learn是Python機器學習領域最成熟的函式庫，長期維護良好
2. **簡單易用**: DBSCAN參數直觀（epsilon: 最大距離, min_samples: 最小點數）
3. **適合地理資料**: DBSCAN能自動識別任意形狀的聚類，適合道路網路的事故分布
4. **效能可接受**: 對於~50萬筆年度資料，DBSCAN的O(n log n)複雜度（使用k-d tree）可接受
5. **PostGIS整合**: 可搭配PostGIS的空間查詢預處理，減少需聚類的資料量

### 替代方案考量
| 方案 | 優點 | 缺點 | 為何不選 |
|------|------|------|---------|
| **HDBSCAN** | 不需指定epsilon，層次聚類 | 較複雜、參數調校困難 | 對本專案過於複雜，epsilon可透過測試確定 |
| **K-Means** | 速度快、實作簡單 | 需預先指定聚類數量、假設球形聚類 | 不適合道路事故的不規則分布 |
| **OPTICS** | 類似DBSCAN但更靈活 | 計算成本高、參數難調 | 效能考量，DBSCAN已足夠 |

### 參數調校策略
- **epsilon**: 起始值500公尺（~0.0045度），透過視覺化調整
- **min_samples**: 起始值5（一個熱點至少包含5起事故），可依事故嚴重程度調整
- **metric**: 使用haversine距離（考慮地球曲率）

### 參考資料
- [scikit-learn DBSCAN文件](https://scikit-learn.org/stable/modules/generated/sklearn.cluster.DBSCAN.html)
- [DBSCAN地理應用案例](https://geoffboeing.com/2014/08/clustering-to-reduce-spatial-data-set-size/)

---

## 2. PostGIS空間查詢優化

### 決策
使用 **GIST索引 + ST_DWithin** 進行空間查詢

### 理由
1. **GIST vs BRIN**:
   - GIST（Generalized Search Tree）: 支援多種幾何運算，查詢速度快
   - BRIN（Block Range Index）: 佔用空間小但僅適合自然排序資料
   - **選擇GIST**: 地理座標無明顯排序，GIST提供最佳查詢效能

2. **ST_DWithin vs ST_Distance**:
   - `ST_DWithin(geom1, geom2, distance)`: 優化的距離查詢，可使用索引
   - `ST_Distance(geom1, geom2) < distance`: 需計算所有點的距離
   - **選擇ST_DWithin**: 自動使用GIST索引，效能優於ST_Distance

3. **經緯度四捨五入策略**:
   - 小數點第3位 ≈ 111公尺精度（台灣緯度）
   - 符合規格需求（最小警示距離100公尺）
   - 減少資料儲存與比對成本

### 索引建立範例
```sql
-- 為geometry欄位建立GIST索引
CREATE INDEX idx_accidents_geom ON accidents USING GIST (geom);
CREATE INDEX idx_hotspots_geom ON hotspots USING GIST (geom);

-- 為時間欄位建立B-tree索引（時間範圍篩選）
CREATE INDEX idx_accidents_occurred_at ON accidents (occurred_at);
```

### 查詢範例
```sql
-- 查詢用戶位置3公里內的熱點
SELECT id, center_lat, center_lng, radius, accident_count
FROM hotspots
WHERE ST_DWithin(
    geom,
    ST_SetSRID(ST_MakePoint(:user_lng, :user_lat), 4326)::geography,
    3000  -- 3公里 = 3000公尺
);
```

### 參考資料
- [PostGIS Performance Tips](https://postgis.net/workshops/postgis-intro/performance.html)
- [PostGIS Index Types](https://postgis.net/docs/using_postgis_dbmanagement.html#gist_indexes)

---

## 3. Google Maps Geocoding API整合

### 決策
採用 **批次處理 + 本地快取** 策略

### 理由
1. **API配額管理**:
   - 免費額度：每月$200美元額度 ≈ 40,000次請求
   - A3資料預估：每月~5,000筆新資料需轉換
   - **結論**: 免費額度足夠，但需實施快取避免重複請求

2. **批次處理策略**:
   - 每月資料擷取時批次處理所有A3地址
   - 使用Python的`googlemaps`函式庫
   - 實施rate limiting：每秒最多50次請求（免費層限制）
   - 失敗重試機制：指數退避（exponential backoff）

3. **快取機制**:
   - 將地址→座標mapping儲存於資料庫
   - 相同地址不重複請求API
   - 預估快取命中率：~30%（同一地點重複事故）

### 實作範例
```python
import googlemaps
import time
from tenacity import retry, stop_after_attempt, wait_exponential

gmaps = googlemaps.Client(key=settings.GOOGLE_MAPS_API_KEY)

@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
def geocode_address(address: str) -> tuple[float, float] | None:
    """
    將台灣地址轉換為經緯度座標

    Args:
        address: 完整地址字串

    Returns:
        (緯度, 經度) 或 None（轉換失敗）
    """
    try:
        result = gmaps.geocode(address, region='tw', language='zh-TW')
        if result:
            location = result[0]['geometry']['location']
            return (location['lat'], location['lng'])
        return None
    except Exception as e:
        logger.error(f"Geocoding failed for {address}: {e}")
        raise
```

### 錯誤處理
- **OVER_QUERY_LIMIT**: 暫停60秒後重試
- **ZERO_RESULTS**: 記錄失敗地址，人工檢視
- **INVALID_REQUEST**: 清理地址格式後重試

### 參考資料
- [Google Maps Geocoding API文件](https://developers.google.com/maps/documentation/geocoding)
- [googlemaps Python客戶端](https://github.com/googlemaps/google-maps-services-python)

---

## 4. Mapbox GL JS最佳實踐

### 決策
使用 **Circle Layer + Clustering** 混合方案

### 理由
1. **熱點視覺化圖層選擇**:
   | 圖層類型 | 優點 | 缺點 | 適用場景 |
   |---------|------|------|---------|
   | Heatmap | 視覺效果佳、直觀 | 無法點擊個別熱點、效能差 | 密度視覺化 |
   | Cluster | 自動聚合、效能好 | 可能隱藏小熱點 | 大量點資料 |
   | Circle | 精確顯示、可自訂樣式 | 大量點時重疊 | 中等數量點 |

   **選擇**: **Circle Layer**（精確顯示每個熱點）+ **Clustering**（縮小時自動聚合）

2. **效能優化策略**:
   - **Vector Tiles**: 使用Mapbox提供的向量地圖底圖（輕量、可快取）
   - **GeoJSON Source**: 前端熱點資料使用GeoJSON格式
   - **Lazy Loading**: 僅載入當前可見範圍的熱點
   - **Debounce**: 地圖移動時延遲500ms再請求新資料

3. **離線地圖支援**:
   - **不支援**: Mapbox GL JS免費版不支援離線地圖
   - **替代方案**: 使用Service Worker快取已瀏覽過的地圖tiles
   - **結論**: 初期不實作，依用戶需求評估

### 實作範例
```typescript
// 初始化地圖
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [120.9605, 23.6978], // 台灣中心
  zoom: 7
});

// 添加熱點圖層
map.on('load', () => {
  // 添加熱點資料源
  map.addSource('hotspots', {
    type: 'geojson',
    data: hotspotGeoJSON,
    cluster: true,
    clusterMaxZoom: 14,  // 超過zoom 14不再聚合
    clusterRadius: 50     // 聚合半徑（像素）
  });

  // 聚合圓圈
  map.addLayer({
    id: 'clusters',
    type: 'circle',
    source: 'hotspots',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': [
        'step',
        ['get', 'point_count'],
        '#51bbd6', 10,
        '#f1f075', 50,
        '#f28cb1'
      ],
      'circle-radius': [
        'step',
        ['get', 'point_count'],
        20, 10,
        30, 50,
        40
      ]
    }
  });

  // 個別熱點
  map.addLayer({
    id: 'hotspot-points',
    type: 'circle',
    source: 'hotspots',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': '#d32f2f',  // 紅色
      'circle-radius': 8,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#fff'
    }
  });
});
```

### Bundle Size控制
- Mapbox GL JS: ~460KB (gzipped)
- 使用Code Splitting延遲載入地圖元件
- 監控工具：webpack-bundle-analyzer

### 參考資料
- [Mapbox GL JS Examples](https://docs.mapbox.com/mapbox-gl-js/example/)
- [Mapbox Performance Best Practices](https://docs.mapbox.com/help/troubleshooting/mapbox-gl-js-performance/)

---

## 5. 即時GPS監控與警示觸發

### 決策
使用 **watchPosition + 前端距離預檢** 方案

### 理由
1. **Geolocation API策略**:
   | 方法 | 優點 | 缺點 | 選擇 |
   |------|------|------|------|
   | `getCurrentPosition()` 輪詢 | 精確控制頻率 | 電量消耗高、程式碼複雜 | ❌ |
   | `watchPosition()` | 自動更新、省電 | 更新頻率不固定 | ✅ |

   **選擇**: `watchPosition()`，設定 `maximumAge: 5000`（最大快取5秒）

2. **前端位置比對演算法**:
   - **問題**: 頻繁呼叫後端API會增加延遲與伺服器負載
   - **解決**: 前端先用Haversine公式粗略計算距離
   - **策略**:
     1. 前端載入當前可見範圍+5km緩衝區的所有熱點
     2. 每次GPS更新時，前端計算與所有熱點的距離
     3. 若進入警示範圍，觸發警示（無需API請求）
     4. 僅在地圖移動超過5km時重新請求熱點資料

3. **震動API瀏覽器支援**:
   - **Vibration API**: 支援Chrome/Edge/Firefox/Opera on Android
   - **不支援**: iOS Safari
   - **降級策略**: 偵測API可用性，iOS僅使用音效+視覺

### 實作範例
```typescript
// 前端距離計算（Haversine公式）
function calculateDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371e3; // 地球半徑（公尺）
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // 距離（公尺）
}

// GPS監控
const watchId = navigator.geolocation.watchPosition(
  (position) => {
    const userLat = position.coords.latitude;
    const userLng = position.coords.longitude;

    // 前端檢查是否接近熱點
    hotspots.forEach(hotspot => {
      const distance = calculateDistance(
        userLat, userLng,
        hotspot.center_lat, hotspot.center_lng
      );

      if (distance <= userSettings.alertDistance) {
        triggerAlert(hotspot);
      }
    });
  },
  (error) => console.error('GPS error:', error),
  {
    enableHighAccuracy: true,
    maximumAge: 5000,        // 最大快取5秒
    timeout: 10000           // 10秒超時
  }
);

// 震動API（降級處理）
function triggerVibration() {
  if ('vibrate' in navigator) {
    navigator.vibrate([200, 100, 200]); // 震動模式
  } else {
    console.warn('Vibration API not supported');
  }
}
```

### 參考資料
- [MDN Geolocation API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API)
- [MDN Vibration API](https://developer.mozilla.org/en-US/docs/Web/API/Vibration_API)

---

## 6. Docker多階段建置

### 決策
使用 **多階段建置 + docker-compose** 方案

### 理由
1. **Python 3.12 + uv 最佳實踐**:
   - 使用官方`python:3.12-slim`基底映像
   - uv安裝速度比pip快10-100倍
   - 多階段建置分離依賴安裝與執行環境

2. **Vite前端建置優化**:
   - Build階段使用`node:20-alpine`
   - Production階段使用`nginx:alpine`提供靜態檔案
   - gzip壓縮與快取設定

3. **docker-compose服務配置**:
   - `postgres`: PostgreSQL 15 + PostGIS擴充
   - `backend`: FastAPI應用
   - `frontend`: Nginx靜態檔案伺服器
   - **不需要Redis**: 目前功能不需要快取層

### 後端Dockerfile範例
```dockerfile
# 階段1: 依賴安裝
FROM python:3.12-slim AS builder

WORKDIR /app

# 安裝uv
RUN pip install uv

# 複製依賴定義
COPY pyproject.toml ./

# 安裝依賴到.venv
RUN uv venv && \
    uv pip install -r pyproject.toml

# 階段2: 執行環境
FROM python:3.12-slim

WORKDIR /app

# 複製虛擬環境
COPY --from=builder /app/.venv /app/.venv

# 複製應用程式碼
COPY ./src ./src

# 設定PATH
ENV PATH="/app/.venv/bin:$PATH"

# 暴露端口
EXPOSE 8000

# 啟動指令
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### docker-compose.yml範例
```yaml
version: '3.8'

services:
  postgres:
    image: postgis/postgis:15-3.3
    environment:
      POSTGRES_DB: road_safety
      POSTGRES_USER: app_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      DATABASE_URL: postgresql://app_user:${DB_PASSWORD}@postgres:5432/road_safety
      GOOGLE_MAPS_API_KEY: ${GOOGLE_MAPS_API_KEY}
    depends_on:
      - postgres
    ports:
      - "8000:8000"

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "80:80"
    depends_on:
      - backend

volumes:
  postgres_data:
```

### 參考資料
- [Docker Multi-stage Builds](https://docs.docker.com/develop/develop-images/multistage-build/)
- [uv Documentation](https://github.com/astral-sh/uv)
- [PostGIS Docker Image](https://registry.hub.docker.com/r/postgis/postgis/)

---

## 總結

所有6個技術研究項目已完成決策，主要選擇理由：

1. **DBSCAN**: 成熟穩定、適合地理聚類
2. **GIST + ST_DWithin**: 最佳空間查詢效能
3. **批次處理 + 快取**: 節省Geocoding API配額
4. **Circle + Clustering**: 平衡視覺與效能
5. **watchPosition + 前端預檢**: 降低API請求、提升回應速度
6. **多階段Docker**: 優化映像大小與建置速度

接下來可進入 **Phase 1: 設計與契約** 階段。

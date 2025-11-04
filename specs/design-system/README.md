# Town Pass Design System

Town Pass 智慧道路守護系統的設計系統文件。

## 📚 文件結構

```
specs/design-system/
├── README.md                    # 本文件
├── showcase.html                # 設計系統總覽（主入口）
├── component-library.html       # 元件庫
└── icons/
    └── index.html              # 完整圖標系統
```

## 🎯 主入口

**開始使用請開啟**: `showcase.html`

這是設計系統的統一入口，包含：
- 色彩系統（Color System）
- 字體系統（Typography）
- 間距系統（Spacing System）
- 元件展示（Components）
- 圖標系統（Icon System）- 連結到完整的 icons 頁面

## 🎨 設計系統內容

### 1. 色彩系統

#### 主色系（Primary）
- **用途**：主要操作、強調元素、連結
- **主要色**：`#5AB4C5` (青藍色)
- **漸層範圍**：50-900

#### 次要色系（Secondary）
- **用途**：次要操作、裝飾元素
- **主要色**：`#F5BA4B` (金黃色)
- **漸層範圍**：50-900

#### 語意色彩（Semantic）
- **成功 Success**：`#76A732` - 成功訊息、完成狀態
- **警告 Warning**：`#FD853A` - 警告訊息、需注意事項
- **危險 Danger**：`#D45251` - 錯誤訊息、危險操作

#### 灰階色彩（Grey）
- **用途**：文字、邊框、背景
- **漸層範圍**：50-950

### 2. 字體系統

**字型家族**: PingFang SC, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif

| 樣式 | 尺寸 | 行高 | 粗細 | 用途 |
|------|------|------|------|------|
| H1 Semibold | 36px | 48px | 600 | 主標題 |
| H2 Semibold | 24px | 32px | 600 | 次標題 |
| Body Semibold | 14px | 20px | 600 | 強調文字、按鈕 |
| Body Regular | 14px | 20px | 400 | 正文內容 |

### 3. 間距系統

| Token | 值 | 用途 |
|-------|-----|------|
| `--space-xs` | 4px | 極小間距 |
| `--space-sm` | 8px | 小間距 |
| `--space-md` | 16px | 中間距（最常用） |
| `--space-lg` | 24px | 大間距 |
| `--space-xl` | 32px | 特大間距 |
| `--space-2xl` | 48px | 超大間距 |
| `--space-3xl` | 64px | 巨大間距 |

### 4. 圓角系統

| Token | 值 | 用途 |
|-------|-----|------|
| `--radius-sm` | 4px | 小元件 |
| `--radius-md` | 8px | 一般元件 |
| `--radius-lg` | 12px | 卡片 |
| `--radius-xl` | 16px | 大型容器 |
| `--radius-full` | 9999px | 圓形按鈕、徽章 |

### 5. 陰影系統

| Token | 值 | 用途 |
|-------|-----|------|
| `--shadow-sm` | 0 1px 2px rgba(0,0,0,0.05) | 微陰影 |
| `--shadow-md` | 0 4px 6px rgba(0,0,0,0.1) | 一般卡片 |
| `--shadow-lg` | 0 10px 15px rgba(0,0,0,0.1) | 懸浮效果 |
| `--shadow-xl` | 0 20px 25px rgba(0,0,0,0.1) | 彈出層 |

## 🧩 元件庫

### 按鈕（Buttons）
- Primary Button - 主要操作
- Secondary Button - 次要操作
- Success/Warning/Danger - 語意化按鈕
- Outline Button - 外框按鈕
- Disabled State - 禁用狀態

### 表單（Forms）
- Input 輸入框
- Label 標籤
- Form Group 表單組

### 卡片（Cards）
- 標準卡片佈局
- Hover 效果

### 提示（Alerts）
- Success Alert
- Warning Alert
- Danger Alert

### 標籤（Badges）
- Primary Badge
- Success Badge
- Warning Badge
- Danger Badge

### 頁籤（Tabs）
- 水平導航
- Active 狀態

## 🎨 圖標系統

完整的圖標系統請參考 `icons/index.html`

### Icon 分類

| 分類 | 數量 | 說明 |
|------|------|------|
| **Primary Icons** | 24 | 基礎功能圖標：check, cancel, add, remove, search, menu, edit, trash, etc. |
| **Tabber Icons** | 5 | 底部導航：home, service, card, coupon, account |
| **List Item Icons** | 8 | 列表圖標：arrow, info, document, calendar, clock, location, phone |
| **Pop Up Icons** | 4 | 彈出視窗：alert, check_circle, error_circle, question |
| **Town Pass Icons** | 12 | 專屬功能：essential_goods, water_meter, explore_taipei, checkin, report, etc. |
| **Map Icons** | 15 | 地圖標記：mappin, vaccine, ubike, wifi, aed, parking, refuge, etc. |
| **Logo Icons** | 2 | 品牌標誌：horizontal, standard |

### Icon 功能
- ✅ 即時搜尋
- ✅ 三種尺寸（24px / 32px / 48px）
- ✅ 四種主題配色
- ✅ 點擊複製 SVG 程式碼
- ✅ 響應式設計

## 💻 使用方式

### 在 HTML 中使用

```html
<!-- 引用 CSS 變數 -->
<style>
  :root {
    /* 從 showcase.html 複製 CSS 變數 */
  }
</style>

<!-- 使用元件 -->
<button class="btn btn-primary">主要按鈕</button>
<div class="card">卡片內容</div>
```

### 在 Vue 專案中使用

```vue
<template>
  <button class="btn-primary">按鈕</button>
</template>

<style scoped>
/* 引用設計系統的 CSS 變數 */
.btn-primary {
  background: var(--primary-500);
  color: white;
  padding: var(--space-sm) var(--space-lg);
  border-radius: var(--radius-md);
}
</style>
```

### 使用 Icon

```html
<!-- 直接使用 SVG -->
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path d="M20 6L9 17l-5-5"/>
</svg>
```

## 📱 響應式設計

設計系統內建響應式支援：
- 手機（< 768px）
- 平板（768px - 1024px）
- 桌面（> 1024px）

## 🔄 更新紀錄

### v1.0.0 (2025-01-04)
- ✅ 建立完整色彩系統
- ✅ 定義字體系統
- ✅ 設定間距與圓角規範
- ✅ 實作基礎元件庫
- ✅ 整合 70+ 圖標系統
- ✅ 建立統一的入口頁面

## 🎯 給 AI 的實作指引

當你需要實作前端 UI 時：

1. **第一步**：開啟 `showcase.html` 查看完整的設計系統
2. **選擇元件**：根據需求選擇合適的元件樣式
3. **使用變數**：使用 CSS 變數（如 `var(--primary-500)`）而非直接寫死色碼
4. **選擇圖標**：從 `icons/index.html` 挑選合適的圖標
5. **保持一致**：確保間距、圓角、陰影等都使用設計系統定義的值

### 範例：實作一個警告卡片

```html
<div style="
  background: rgba(253, 133, 58, 0.1);
  color: var(--orange-500);
  border-left: 4px solid var(--orange-500);
  padding: var(--space-md) var(--space-lg);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  gap: var(--space-md);
">
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
    <path d="M12 9v4m0 4h.01"/>
  </svg>
  <span>請注意：此操作可能會影響其他使用者。</span>
</div>
```

## 📞 相關資源

- **Figma 設計稿**: [Town Pass Design System](https://www.figma.com/design/ARet777BscOrcNFXAxJsgi/城市通-Town-Pass-Open-Source-Gov-Mobile-App-UI-kit-and-design-system--Community-)
- **專案文件**: `specs/001-road-safety-system/`

## ⚠️ 重要提醒

1. **不要直接寫死顏色值**：使用 CSS 變數確保一致性
2. **遵循間距系統**：使用定義好的 spacing tokens
3. **使用語意化命名**：按鈕使用 `.btn-primary` 而非 `.blue-button`
4. **參考圖標系統**：不要自己畫圖標，從系統中選擇
5. **保持響應式**：確保在不同裝置上都能正常顯示

---

**維護者**: Town Pass 開發團隊
**最後更新**: 2025-01-04

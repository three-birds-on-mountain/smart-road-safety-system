import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { store } from './store'
import './index.css'
import App from './App.tsx'

// === 環境變數驗證 ===
// 在應用啟動前檢查必要的環境變數
const requiredEnvVars = {
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
  VITE_MAPBOX_ACCESS_TOKEN: import.meta.env.VITE_MAPBOX_ACCESS_TOKEN,
}

const missingEnvVars = Object.entries(requiredEnvVars)
  .filter(([, value]) => !value)
  .map(([key]) => key)

if (missingEnvVars.length > 0) {
  const errorMessage = `
❌ 缺少必要的環境變數！

請在 .env 檔案中設定以下環境變數：
${missingEnvVars.map((key) => `  - ${key}`).join('\n')}

參考 .env.example 檔案以取得範例設定。
  `.trim()

  console.error(errorMessage)

  // 在開發模式下顯示錯誤訊息
  if (import.meta.env.DEV) {
    document.getElementById('root')!.innerHTML = `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        padding: 2rem;
      ">
        <div style="
          background: white;
          border-radius: 12px;
          padding: 2rem;
          max-width: 600px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        ">
          <h1 style="
            color: #D45251;
            margin: 0 0 1rem 0;
            font-size: 1.5rem;
            font-weight: 600;
          ">
            ❌ 環境變數設定錯誤
          </h1>
          <p style="
            color: #4B5563;
            margin: 0 0 1rem 0;
            line-height: 1.6;
          ">
            請在專案根目錄的 <code style="
              background: #F3F4F6;
              padding: 0.125rem 0.375rem;
              border-radius: 4px;
              font-family: 'Monaco', 'Courier New', monospace;
            ">.env</code> 檔案中設定以下環境變數：
          </p>
          <ul style="
            background: #FEF2F2;
            border-left: 4px solid #D45251;
            padding: 1rem 1rem 1rem 2rem;
            margin: 1rem 0;
            border-radius: 4px;
          ">
            ${missingEnvVars.map((key) => `<li style="margin: 0.5rem 0;"><code style="color: #D45251; font-weight: 600;">${key}</code></li>`).join('')}
          </ul>
          <p style="
            color: #6B7280;
            margin: 0;
            font-size: 0.875rem;
          ">
            💡 提示：參考 <code style="
              background: #F3F4F6;
              padding: 0.125rem 0.375rem;
              border-radius: 4px;
              font-family: 'Monaco', 'Courier New', monospace;
            ">.env.example</code> 檔案以取得範例設定。
          </p>
        </div>
      </div>
    `
  }

  throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`)
}

// 環境變數驗證通過，啟動應用
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>,
)

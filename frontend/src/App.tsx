import MapPage from './pages/MapPage'
import SettingsPage from './pages/SettingsPage'
import SettingsIconButton from './components/Settings/SettingsIconButton'
import { useAppDispatch, useAppSelector } from './hooks/store'
import { toggleSettingsModal, closeSettingsModal } from './store/uiSlice'

/**
 * App 根元件
 * 手機版 APP 設計：全螢幕地圖 + 浮動設定按鈕 + 條件式設定 Modal
 */
const App = () => {
  const dispatch = useAppDispatch()
  const isSettingsModalOpen = useAppSelector(
    (state) => state.ui.isSettingsModalOpen,
  )

  const handleToggleSettings = () => {
    dispatch(toggleSettingsModal())
  }

  const handleCloseSettings = () => {
    dispatch(closeSettingsModal())
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-surface-muted">
      {/* 主畫面：全螢幕地圖 */}
      <MapPage />

      {/* 浮動設定按鈕（固定於右下角） */}
      {!isSettingsModalOpen && (
        <SettingsIconButton onClick={handleToggleSettings} />
      )}

      {/* 設定頁 Modal（全屏覆蓋） */}
      {isSettingsModalOpen && (
        <SettingsPage onClose={handleCloseSettings} />
      )}
    </div>
  )
}

export default App

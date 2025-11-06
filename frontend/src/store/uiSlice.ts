import { createSlice } from '@reduxjs/toolkit'

/**
 * UI Slice: 管理全域 UI 狀態
 * 包含設定頁 Modal 的開啟/關閉狀態
 */

interface UiState {
  isSettingsModalOpen: boolean
}

const initialState: UiState = {
  isSettingsModalOpen: false,
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    /**
     * 開啟設定 Modal
     */
    openSettingsModal: (state) => {
      state.isSettingsModalOpen = true
    },

    /**
     * 關閉設定 Modal
     */
    closeSettingsModal: (state) => {
      state.isSettingsModalOpen = false
    },

    /**
     * 切換設定 Modal 狀態（開啟⇄關閉）
     */
    toggleSettingsModal: (state) => {
      state.isSettingsModalOpen = !state.isSettingsModalOpen
    },
  },
})

export const { openSettingsModal, closeSettingsModal, toggleSettingsModal } =
  uiSlice.actions

export default uiSlice.reducer

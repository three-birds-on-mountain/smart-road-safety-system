/**
 * 浮動設定按鈕元件
 * 固定於螢幕右下角，提供快速開啟設定頁的入口
 */

interface SettingsIconButtonProps {
  onClick: () => void
  className?: string
}

const SettingsIconButton = ({
  onClick,
  className = '',
}: SettingsIconButtonProps) => {
  return (
    <button
      onClick={onClick}
      className={[
        // 固定定位於右下角
        'fixed bottom-6 right-6 z-50',
        // 尺寸與形狀
        'h-14 w-14 rounded-full',
        // 設計系統色彩
        'bg-primary-500 hover:bg-primary-600 active:bg-primary-700',
        // 陰影效果
        'shadow-lg hover:shadow-xl',
        // 過渡動畫
        'transition-all duration-200',
        // 無障礙與互動
        'focus:outline-none focus:ring-4 focus:ring-primary-500/40',
        // 確保在手機上易於點擊
        'touch-manipulation',
        className,
      ].join(' ')}
      aria-label="開啟設定"
      type="button"
    >
      {/* 齒輪圖標 (使用 SVG) */}
      <svg
        className="mx-auto h-6 w-6 text-white"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    </button>
  )
}

export default SettingsIconButton

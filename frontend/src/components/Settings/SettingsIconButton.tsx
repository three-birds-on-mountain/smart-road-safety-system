/**
 * 浮動設定按鈕元件
 * 固定於螢幕右下角，提供快速開啟設定頁的入口
 */

import settingsIcon from '../../assets/settings.svg';

interface SettingsIconButtonProps {
  onClick: () => void;
  className?: string;
}

const SettingsIconButton = ({ onClick, className = '' }: SettingsIconButtonProps) => {
  return (
    <button
      onClick={onClick}
      className={[
        // 固定定位於右下角
        'fixed bottom-[80px] right-6 z-50',
        // 尺寸與形狀
        'h-[54px] w-[54px] rounded-full',
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
      {/* 齒輪圖標 */}
      <img src={settingsIcon} alt="" className="mx-auto h-6 w-6" aria-hidden="true" />
    </button>
  );
};

export default SettingsIconButton;

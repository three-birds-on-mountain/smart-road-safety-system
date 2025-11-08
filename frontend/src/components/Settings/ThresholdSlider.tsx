import { useAppDispatch, useAppSelector } from '../../hooks/store';
import { updateAccidentThreshold } from '../../store/settingsSlice';

const ThresholdSlider = () => {
  const dispatch = useAppDispatch();
  const threshold = useAppSelector(
    (state) => state.settings.current.accidentThreshold ?? 1,
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value)) {
      dispatch(updateAccidentThreshold(value));
    }
  };

  return (
    <section className="flex flex-col gap-md">
      <header className="flex flex-col gap-xs">
        <h2 className="text-lg font-semibold text-text-primary">事故數量篩選</h2>
        <p className="text-sm text-text-secondary">
          只顯示事故總數大於或等於所選數量的熱點，避免單一事故的熱點干擾。
        </p>
      </header>

      <div className="flex flex-col gap-sm rounded-lg border border-gray-100 bg-white px-md py-md shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-text-primary">門檻值</span>
          <span className="text-lg font-semibold text-primary-600">
            {threshold} 筆
          </span>
        </div>

        <div className="flex items-center gap-sm">
          <span className="text-xs text-text-description">1</span>
          <input
            type="range"
            min="1"
            max="10"
            step="1"
            value={threshold}
            onChange={handleChange}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-500"
            aria-label="設定事故數量門檻"
          />
          <span className="text-xs text-text-description">10</span>
        </div>

        <p className="text-xs text-text-description">
          {threshold === 1
            ? '顯示所有事故熱點（包含單一事故）'
            : `只顯示事故數 ≥ ${threshold} 筆的熱點`}
        </p>
      </div>
    </section>
  );
};

export default ThresholdSlider;

import type { TimeRangeOption } from '../../types/settings';
import { useAppDispatch, useAppSelector } from '../../hooks/store';
import { updateTimeRange } from '../../store/settingsSlice';

const TIME_RANGE_OPTIONS: Array<{
  value: TimeRangeOption;
  label: string;
  description: string;
}> = [
  { value: '1Y', label: '一年內', description: '預設，包含過去一年內事故' },
  { value: '6M', label: '半年內', description: '縮小範圍，排除較舊事故' },
  { value: '3M', label: '三個月內', description: '近期事故高峰' },
  { value: '1M', label: '一個月內', description: '非常新近的事故熱點' },
];

const TimeRangeFilter = () => {
  const dispatch = useAppDispatch();
  const currentRange = useAppSelector(
    (state) => state.settings.current.timeRange,
  );

  const handleChange = (range: TimeRangeOption) => {
    if (range !== currentRange) {
      dispatch(updateTimeRange(range));
    }
  };

  return (
    <section className="flex flex-col gap-md">
      <header className="flex flex-col gap-xs">
        <h2 className="text-lg font-semibold text-text-primary">事故時間範圍</h2>
        <p className="text-sm text-text-secondary">
          選擇要考量的事故發生時間範圍，框定提醒的熱點資料。
        </p>
      </header>
      <div className="grid gap-sm md:grid-cols-2">
        {TIME_RANGE_OPTIONS.map((option) => {
          const isSelected = option.value === currentRange;
          return (
            <label
              key={option.value}
              className={[
                'flex cursor-pointer flex-col gap-xs rounded-lg border px-md py-md shadow-sm transition',
                isSelected
                  ? 'border-primary-500 bg-primary-50 text-primary-700 shadow-md'
                  : 'border-gray-100 bg-white text-text-primary hover:border-primary-200',
              ].join(' ')}
            >
              <div className="flex items-center gap-sm">
                <span className="flex items-center gap-xs">
                  <input
                    type="radio"
                    className="peer sr-only"
                    name="time-range"
                    value={option.value}
                    checked={isSelected}
                    onChange={() => handleChange(option.value)}
                    aria-label={`選擇 ${option.label}`}
                  />
                  <span
                    className="flex h-4 w-4 items-center justify-center rounded-full border border-primary-500 bg-white transition peer-checked:bg-primary-500 peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500"
                    aria-hidden="true"
                  >
                    <span className="h-2 w-2 rounded-full bg-white opacity-0 transition peer-checked:opacity-100" />
                  </span>
                </span>
                <span className="text-sm font-semibold">{option.label}</span>
              </div>
              <span className="text-xs text-text-description">
                {option.description}
              </span>
            </label>
          );
        })}
      </div>
    </section>
  );
};

export default TimeRangeFilter;

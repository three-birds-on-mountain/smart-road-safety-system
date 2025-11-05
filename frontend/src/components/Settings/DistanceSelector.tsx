import type { AlertDistanceOption } from '../../types/settings';
import { useAppDispatch, useAppSelector } from '../../hooks/store';
import { updateDistance } from '../../store/settingsSlice';

const DISTANCE_OPTIONS: Array<{
  value: AlertDistanceOption;
  label: string;
  description: string;
}> = [
  { value: 100, label: '100 公尺', description: '都市路口或低速路段' },
  { value: 500, label: '500 公尺', description: '預設距離，適用一般市區' },
  { value: 1000, label: '1 公里', description: '快速道路與快速通勤' },
  { value: 3000, label: '3 公里', description: '長程或高速行駛' },
];

const DistanceSelector = () => {
  const dispatch = useAppDispatch();
  const selectedDistance = useAppSelector(
    (state) => state.settings.current.distanceMeters,
  );

  const handleSelect = (distance: AlertDistanceOption) => {
    if (distance !== selectedDistance) {
      dispatch(updateDistance(distance));
    }
  };

  return (
    <section className="flex flex-col gap-md">
      <header className="flex flex-col gap-xs">
        <h2 className="text-lg font-semibold text-text-primary">提醒距離</h2>
        <p className="text-sm text-text-secondary">
          選擇距離範圍，系統將在進入距離內的事故熱點時提醒您。
        </p>
      </header>
      <div className="grid gap-sm md:grid-cols-2">
        {DISTANCE_OPTIONS.map((option) => {
          const isActive = option.value === selectedDistance;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value)}
              aria-pressed={isActive}
              className={[
                'flex flex-col gap-xs rounded-lg border px-md py-md text-left shadow-sm transition',
                isActive
                  ? 'border-primary-500 bg-primary-50 text-primary-700 shadow-md'
                  : 'border-gray-100 bg-white text-text-primary hover:border-primary-200',
              ].join(' ')}
            >
              <span className="text-base font-semibold">{option.label}</span>
              <span className="text-xs text-text-description">
                {option.description}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default DistanceSelector;

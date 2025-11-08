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
        <h2 className="text-lg font-semibold text-text-primary">警示距離</h2>
        <p className="text-sm text-text-secondary">
          選擇警示距離範圍，系統會在進入範圍內的事故熱點時提醒並顯示標記。
        </p>
      </header>
      <div className="grid gap-sm md:grid-cols-2">
        {DISTANCE_OPTIONS.map((option) => {
          const isActive = option.value === selectedDistance;
          return (
            <label
              key={option.value}
              className={[
                'flex cursor-pointer flex-col gap-xs rounded-lg border px-md py-md shadow-sm transition',
                isActive
                  ? 'border-primary-500 bg-primary-50 text-primary-700 shadow-md'
                  : 'border-gray-100 bg-white text-text-primary hover:border-primary-200',
              ].join(' ')}
            >
              <div className="flex items-center gap-sm">
                <span className="flex items-center gap-xs">
                  <input
                    type="radio"
                    className="peer sr-only"
                    name="distance-option"
                    value={option.value}
                    checked={isActive}
                    onChange={() => handleSelect(option.value)}
                    aria-label={`選擇 ${option.label}`}
                  />
                  <span
                    className={[
                      'pointer-events-none flex h-4 w-4 items-center justify-center rounded-full border border-primary-500 bg-white transition',
                      'peer-checked:bg-primary-500 peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500',
                      'peer-checked:[&>span]:opacity-100',
                    ].join(' ')}
                    aria-hidden="true"
                  >
                    <span className="h-2 w-2 rounded-full bg-white opacity-0 transition" />
                  </span>
                </span>
                <span className="text-sm font-semibold">{option.label}</span>
              </div>
              <span className="text-xs text-text-description">{option.description}</span>
            </label>
          );
        })}
      </div>
    </section>
  );
};

export default DistanceSelector;

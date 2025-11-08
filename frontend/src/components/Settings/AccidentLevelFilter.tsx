import type { AccidentSeverity } from '../../types/accident';
import { useAppDispatch, useAppSelector } from '../../hooks/store';
import { updateSeverityFilter } from '../../store/settingsSlice';
import checkYesIcon from '../../assets/check-yes.svg';
import checkNoIcon from '../../assets/check-no.svg';

const SEVERITY_OPTIONS: Array<{
  value: AccidentSeverity;
  label: string;
  description: string;
  badgeClass: string;
}> = [
  {
    value: 'A1',
    label: 'A1｜重大事故',
    description: '涉及死亡事故，務必高度注意',
    badgeClass: 'bg-danger-500 text-white',
  },
  {
    value: 'A2',
    label: 'A2｜受傷事故',
    description: '有人受傷或需要救援的事故案例',
    badgeClass: 'bg-warning-500 text-white',
  },
  {
    value: 'A3',
    label: 'A3｜財損事故',
    description: '財物損失為主的事故',
    badgeClass: 'bg-secondary-500 text-white',
  },
];

const AccidentLevelFilter = () => {
  const dispatch = useAppDispatch();
  const selectedSeverities = useAppSelector((state) => state.settings.current.severityFilter);

  const handleToggle = (severity: AccidentSeverity) => {
    const isSelected = selectedSeverities.includes(severity);
    if (isSelected) {
      if (selectedSeverities.length === 1) {
        return;
      }
      dispatch(updateSeverityFilter(selectedSeverities.filter((level) => level !== severity)));
      return;
    }
    dispatch(updateSeverityFilter([...selectedSeverities, severity]));
  };

  return (
    <section className="flex flex-col gap-md">
      <header className="flex flex-col gap-xs">
        <h2 className="text-lg font-semibold text-text-primary">事故等級</h2>
        <p className="text-sm text-text-secondary">
          選擇於地圖上顯示並警示的事故等級，至少需保留一項。
        </p>
      </header>

      <div className="grid gap-sm md:grid-cols-3">
        {SEVERITY_OPTIONS.map((option) => {
          const isChecked = selectedSeverities.includes(option.value);
          return (
            <label
              key={option.value}
              className={[
                'flex h-full cursor-pointer flex-col gap-sm rounded-lg border px-md py-md shadow-sm transition',
                isChecked
                  ? 'border-primary-500 bg-primary-50 text-primary-700 shadow-md'
                  : 'border-gray-100 bg-white text-text-primary hover:border-primary-200',
              ].join(' ')}
            >
              <div className="flex items-center justify-between gap-sm">
                <span
                  className={[
                    'rounded-full px-sm py-xs text-xs font-semibold uppercase tracking-wide',
                    option.badgeClass,
                  ].join(' ')}
                >
                  {option.value}
                </span>
                <div className="flex items-center gap-xs">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={isChecked}
                    onChange={() => handleToggle(option.value)}
                    aria-label={`切換 ${option.label}`}
                  />
                  <span
                    className={[
                      'mt-[2px] pointer-events-none relative block h-6 w-6 rounded transition',
                      'peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500',
                    ].join(' ')}
                    aria-hidden="true"
                  >
                    <img
                      src={checkNoIcon}
                      alt=""
                      className="absolute inset-0 h-full w-full"
                    />
                    <img
                      src={checkYesIcon}
                      alt=""
                      className={[
                        'absolute inset-0 h-full w-full transition-opacity duration-150',
                        isChecked ? 'opacity-100' : 'opacity-0',
                      ].join(' ')}
                    />
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-xs">
                <span className="text-sm font-semibold">{option.label}</span>
                <span className="text-xs text-text-description">{option.description}</span>
              </div>
            </label>
          );
        })}
      </div>
    </section>
  );
};

export default AccidentLevelFilter;

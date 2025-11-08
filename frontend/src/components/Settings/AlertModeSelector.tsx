import { useMemo } from 'react';
import type { AlertChannel } from '../../types/settings';
import { useAppDispatch, useAppSelector } from '../../hooks/store';
import { updateAlertChannels } from '../../store/settingsSlice';
import checkYesIcon from '../../assets/check-yes.svg';
import checkNoIcon from '../../assets/check-no.svg';

const CHANNEL_OPTIONS: Array<{
  value: AlertChannel;
  label: string;
  description: string;
  icon: string;
}> = [
  {
    value: 'sound',
    label: '音效提醒',
    description: '播放系統提示音（需開啟手機音量）',
    icon: '🔊',
  },
  {
    value: 'vibration',
    label: '震動提醒',
    description: '觸發震動，可在靜音模式下使用',
    icon: '📳',
  },
];

const AlertModeSelector = () => {
  const dispatch = useAppDispatch();
  const selectedChannels = useAppSelector((state) => state.settings.current.alertChannels);

  const isVisualOnly = selectedChannels.length === 0;

  const visualOnlyDescription = useMemo(() => {
    if (isVisualOnly) {
      return '目前僅顯示視覺警示，不會播放音效或震動提醒。';
    }
    return '勾選音效與震動可同時啟用多種提醒方式。';
  }, [isVisualOnly]);

  const toggleChannel = (channel: AlertChannel) => {
    const hasChannel = selectedChannels.includes(channel);

    if (isVisualOnly) {
      dispatch(updateAlertChannels([channel]));
      return;
    }

    if (hasChannel) {
      const next = selectedChannels.filter((item) => item !== channel);
      dispatch(updateAlertChannels(next));
      return;
    }

    dispatch(updateAlertChannels([...selectedChannels, channel]));
  };

  const toggleVisualOnly = () => {
    if (isVisualOnly) {
      dispatch(updateAlertChannels(['sound']));
      return;
    }
    dispatch(updateAlertChannels([]));
  };

  return (
    <section className="flex flex-col gap-md">
      <header className="flex flex-col gap-xs">
        <h2 className="text-lg font-semibold text-text-primary">警示方式</h2>
        <p className="text-sm text-text-secondary">可同時選擇音效與震動，或改為僅顯示視覺提示。</p>
      </header>

      <div className="flex flex-col gap-sm">
        {CHANNEL_OPTIONS.map((option) => {
          const isChecked = selectedChannels.includes(option.value);
          const showActive = isChecked && !isVisualOnly;
          return (
            <label
              key={option.value}
              className={[
                'flex cursor-pointer items-start gap-md rounded-lg border px-md py-md shadow-sm transition',
                isChecked && !isVisualOnly
                  ? 'border-primary-500 bg-primary-50 text-primary-700 shadow-md'
                  : 'border-gray-100 bg-white text-text-primary hover:border-primary-200',
                isVisualOnly ? 'opacity-60 transition-opacity hover:opacity-80' : '',
              ].join(' ')}
            >
              <div className="flex items-start gap-sm">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={showActive}
                  disabled={isVisualOnly}
                  onChange={() => toggleChannel(option.value)}
                  aria-label={option.label}
                />
                <span
                  className={[
                    'mt-[2px] pointer-events-none relative block h-6 w-6 rounded transition',
                    'peer-disabled:opacity-40',
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
                      showActive ? 'opacity-100' : 'opacity-0',
                    ].join(' ')}
                  />
                </span>
              </div>
              <div className="flex flex-col gap-xs">
                <span className="flex items-center gap-xs text-sm font-semibold">
                  <span aria-hidden>{option.icon}</span>
                  {option.label}
                </span>
                <span className="text-xs text-text-description">{option.description}</span>
              </div>
            </label>
          );
        })}
      </div>

      <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-white px-md py-sm shadow-sm">
        <div className="flex flex-col gap-xs">
          <p className="text-sm font-semibold text-text-primary">僅顯示視覺警示</p>
          <p className="text-xs text-text-description">{visualOnlyDescription}</p>
        </div>
        <label className="relative inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            className="peer sr-only"
            checked={isVisualOnly}
            onChange={toggleVisualOnly}
            aria-label="切換僅顯示視覺警示"
          />
          <span
            className={[
              'relative block h-[26px] w-[40px] rounded-full border border-gray-200 bg-gray-100 transition-colors duration-200',
              "after:absolute after:left-[3px] after:top-[2px] after:h-[20px] after:w-[20px] after:rounded-full after:bg-surface-white after:shadow-sm after:transition-transform after:duration-200 after:content-['']",
              'peer-checked:border-primary-500 peer-checked:bg-primary-500 peer-checked:after:translate-x-[13px]',
            ].join(' ')}
          />
        </label>
      </div>
    </section>
  );
};

export default AlertModeSelector;

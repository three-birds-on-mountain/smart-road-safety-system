import { fireEvent, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';
import SettingsPage from '../../src/pages/SettingsPage';
import { renderWithProviders } from '../utils/renderWithProviders';

describe('[US2] Settings flow integration', () => {
  it('updates summaries as soon as settings change', () => {
    const { store } = renderWithProviders(<SettingsPage />);

    const distanceButton = screen.getByRole('button', { name: /1 公里/i });
    fireEvent.click(distanceButton);
    expect(screen.getAllByText(/距離：1000 公尺/)).toHaveLength(2);

    const timeRangeRadio = screen.getByLabelText('選擇 三個月內');
    fireEvent.click(timeRangeRadio);
    expect(screen.getAllByText(/時間範圍：三個月內/)).toHaveLength(2);

    const visualOnlySwitch = screen.getByLabelText('切換僅顯示視覺警示');
    fireEvent.click(visualOnlySwitch);
    expect(screen.getAllByText(/提醒方式：僅視覺提示/)[0]).toBeInTheDocument();

    const state = store.getState().settings.current;
    expect(state.distanceMeters).toBe(1000);
    expect(state.timeRange).toBe('3M');
    expect(state.alertChannels).toEqual([]);
  });
});

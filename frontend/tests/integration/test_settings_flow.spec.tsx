import { fireEvent, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';
import SettingsPage from '../../src/pages/SettingsPage';
import { renderWithProviders } from '../utils/renderWithProviders';

describe('[US2] Settings flow integration', () => {
  it('updates summaries as soon as settings change', () => {
    const { store } = renderWithProviders(<SettingsPage onClose={() => undefined} />);

    const distanceButton = screen.getByRole('button', { name: /1 公里/i });
    fireEvent.click(distanceButton);
    expect(screen.getAllByText(/1000m/i).length).toBeGreaterThan(0);

    const timeRangeRadio = screen.getByLabelText('選擇 三個月內');
    fireEvent.click(timeRangeRadio);
    expect(screen.getAllByText('三個月內').length).toBeGreaterThan(0);

    const visualOnlySwitch = screen.getByLabelText('切換僅顯示視覺警示');
    fireEvent.click(visualOnlySwitch);
    expect(screen.getAllByText('僅視覺提示').length).toBeGreaterThan(0);

    const state = store.getState().settings.current;
    expect(state.distanceMeters).toBe(1000);
    expect(state.timeRange).toBe('3M');
    expect(state.alertChannels).toEqual([]);
  });
});

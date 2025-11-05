import { fireEvent, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';
import AlertModeSelector from '../../../src/components/Settings/AlertModeSelector';
import { renderWithProviders } from '../../utils/renderWithProviders';

describe('AlertModeSelector', () => {
  it('allows enabling vibration alongside sound', () => {
    const { store } = renderWithProviders(<AlertModeSelector />);

    const vibrationCheckbox = screen.getByLabelText('震動提醒');
    expect(vibrationCheckbox).not.toBeChecked();

    fireEvent.click(vibrationCheckbox);

    const { alertChannels } = store.getState().settings.current;
    expect(alertChannels).toEqual(['sound', 'vibration']);
    expect(vibrationCheckbox).toBeChecked();
  });

  it('switches to visual-only mode and disables other options', () => {
    const { store } = renderWithProviders(<AlertModeSelector />);

    const soundCheckbox = screen.getByLabelText('音效提醒');
    const switchControl = screen.getByLabelText('切換僅顯示視覺警示');

    fireEvent.click(switchControl);

    expect(store.getState().settings.current.alertChannels).toEqual([]);
    expect(soundCheckbox).toBeDisabled();

    fireEvent.click(switchControl);

    expect(store.getState().settings.current.alertChannels).toEqual(['sound']);
    expect(soundCheckbox).not.toBeDisabled();
    expect(soundCheckbox).toBeChecked();
  });
});

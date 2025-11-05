import { fireEvent, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';
import TimeRangeFilter from '../../../src/components/Settings/TimeRangeFilter';
import { renderWithProviders } from '../../utils/renderWithProviders';

describe('TimeRangeFilter', () => {
  it('marks the default time range as selected', () => {
    renderWithProviders(<TimeRangeFilter />);

    const defaultOption = screen.getByLabelText('選擇 一年內');
    expect(defaultOption).toBeChecked();
  });

  it('updates selected time range when a new option is chosen', () => {
    const { store } = renderWithProviders(<TimeRangeFilter />);

    const option = screen.getByLabelText('選擇 三個月內');
    fireEvent.click(option);

    const { timeRange } = store.getState().settings.current;
    expect(timeRange).toBe('3M');
    expect(option).toBeChecked();
  });
});

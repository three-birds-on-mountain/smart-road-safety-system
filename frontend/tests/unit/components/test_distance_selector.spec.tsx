import { fireEvent, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';
import DistanceSelector from '../../../src/components/Settings/DistanceSelector';
import { renderWithProviders } from '../../utils/renderWithProviders';

describe('DistanceSelector', () => {
  it('highlights the currently selected distance', () => {
    renderWithProviders(<DistanceSelector />);

    const defaultOption = screen.getByRole('button', { name: /500 公尺/i });
    expect(defaultOption).toHaveAttribute('aria-pressed', 'true');

    const otherOption = screen.getByRole('button', { name: /100 公尺/i });
    expect(otherOption).toHaveAttribute('aria-pressed', 'false');
  });

  it('updates distance when selecting a new option', () => {
    const { store } = renderWithProviders(<DistanceSelector />);

    const option = screen.getByRole('button', { name: /1 公里/i });
    fireEvent.click(option);

    const state = store.getState().settings.current;
    expect(state.distanceMeters).toBe(1000);
    expect(option).toHaveAttribute('aria-pressed', 'true');
  });
});

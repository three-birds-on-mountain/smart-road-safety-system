import { fireEvent, screen } from '@testing-library/react';
import React, { act } from 'react';
import { describe, expect, it } from 'vitest';
import AccidentLevelFilter from '../../../src/components/Settings/AccidentLevelFilter';
import { updateSeverityFilter } from '../../../src/store/settingsSlice';
import { renderWithProviders } from '../../utils/renderWithProviders';

describe('AccidentLevelFilter', () => {
  it('allows toggling severity levels while keeping others selected', () => {
    const { store } = renderWithProviders(<AccidentLevelFilter />);

    const toggleA3 = screen.getByLabelText('切換 A3｜財損事故');
    fireEvent.click(toggleA3);

    const { severityFilter } = store.getState().settings.current;
    expect(severityFilter).toEqual(['A1', 'A2']);
    expect(toggleA3).not.toBeChecked();
  });

  it('prevents deselecting the final remaining severity', () => {
    const { store } = renderWithProviders(<AccidentLevelFilter />);

    act(() => {
      store.dispatch(updateSeverityFilter(['A1']));
    });

    const toggleA1 = screen.getByLabelText('切換 A1｜重大事故');
    fireEvent.click(toggleA1);

    const { severityFilter } = store.getState().settings.current;
    expect(severityFilter).toEqual(['A1']);
    expect(toggleA1).toBeChecked();
  });
});

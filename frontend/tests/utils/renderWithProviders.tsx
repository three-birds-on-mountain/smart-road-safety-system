import type { PropsWithChildren, ReactElement } from 'react';
import React from 'react';
import { Provider } from 'react-redux';
import { configureStore, type PreloadedState } from '@reduxjs/toolkit';
import { render, type RenderOptions } from '@testing-library/react';
import hotspotsReducer from '../../src/store/hotspotsSlice';
import settingsReducer from '../../src/store/settingsSlice';
import locationReducer from '../../src/store/locationSlice';
import type { RootState, AppDispatch } from '../../src/store';

export const createTestStore = (preloadedState?: PreloadedState<RootState>) =>
  configureStore({
    reducer: {
      hotspots: hotspotsReducer,
      settings: settingsReducer,
      location: locationReducer,
    },
    preloadedState,
  });

interface ProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  preloadedState?: PreloadedState<RootState>;
  store?: ReturnType<typeof createTestStore>;
}

export interface RenderResult extends ReturnType<typeof render> {
  store: ReturnType<typeof createTestStore>;
}

export const renderWithProviders = (
  ui: ReactElement,
  {
    preloadedState,
    store = createTestStore(preloadedState),
    ...renderOptions
  }: ProvidersOptions = {},
): RenderResult => {
  const Wrapper = ({ children }: PropsWithChildren) => (
    <Provider store={store}>{children}</Provider>
  );

  return { store, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
};

export type TestStore = ReturnType<typeof createTestStore>;
export type TestDispatch = AppDispatch;

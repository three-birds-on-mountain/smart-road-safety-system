import type { PropsWithChildren, ReactElement } from 'react';
import React from 'react';
import { Provider } from 'react-redux';
import { render, type RenderOptions } from '@testing-library/react';
import type { PreloadedState } from '@reduxjs/toolkit';
import {
  createAppStore,
  type AppStore,
  type RootState,
  type AppDispatch,
} from '../../src/store';

export const createTestStore = (preloadedState?: PreloadedState<RootState>) =>
  createAppStore(preloadedState);

interface ProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  preloadedState?: PreloadedState<RootState>;
  store?: AppStore;
}

export interface RenderResult extends ReturnType<typeof render> {
  store: AppStore;
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

export type TestStore = AppStore;
export type TestDispatch = AppDispatch;

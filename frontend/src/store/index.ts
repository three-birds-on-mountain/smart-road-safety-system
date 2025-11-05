import { configureStore } from '@reduxjs/toolkit';
import hotspotsReducer from './hotspotsSlice';
import settingsReducer, {
  SETTINGS_STORAGE_KEY,
  sanitizeAlertSettings,
  loadSettingsFromStorage,
  hydrateSettings,
} from './settingsSlice';
import locationReducer from './locationSlice';

type RootReducerState = {
  hotspots: ReturnType<typeof hotspotsReducer>;
  settings: ReturnType<typeof settingsReducer>;
  location: ReturnType<typeof locationReducer>;
};

export const createAppStore = (preloadedState?: Partial<RootReducerState>) => {
  const store = configureStore({
    reducer: {
      hotspots: hotspotsReducer,
      settings: settingsReducer,
      location: locationReducer,
    },
    preloadedState: preloadedState as RootReducerState | undefined,
  });

  if (typeof window !== 'undefined' && window.localStorage) {
    const storedSettings = loadSettingsFromStorage();
    if (storedSettings) {
      store.dispatch(hydrateSettings(storedSettings));
    }
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    let currentSerialized: string | undefined;

    const persistSettings = () => {
      const settings = store.getState().settings.current;
      const sanitized = sanitizeAlertSettings(settings, settings);
      const serialized = JSON.stringify(sanitized);

      if (serialized !== currentSerialized) {
        currentSerialized = serialized;
        try {
          window.localStorage.setItem(SETTINGS_STORAGE_KEY, serialized);
        } catch {
          // Ignore persistence failures (e.g., private mode).
        }
      }
    };

    persistSettings();
    store.subscribe(persistSettings);
  }

  return store;
};

export type AppStore = ReturnType<typeof createAppStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];

export const store = createAppStore();

export { SETTINGS_STORAGE_KEY } from './settingsSlice';

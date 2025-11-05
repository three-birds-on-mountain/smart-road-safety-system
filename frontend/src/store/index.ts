import { configureStore } from '@reduxjs/toolkit';
import hotspotsReducer from './hotspotsSlice';
import settingsReducer from './settingsSlice';
import locationReducer from './locationSlice';

export const store = configureStore({
  reducer: {
    hotspots: hotspotsReducer,
    settings: settingsReducer,
    location: locationReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

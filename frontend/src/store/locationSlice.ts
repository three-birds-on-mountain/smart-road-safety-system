import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { GPSStatus } from '../types/settings';

export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
  heading?: number | null;
  speed?: number | null;
  timestamp: number;
}

interface LocationState {
  current?: Coordinates;
  status: GPSStatus;
  permissionGranted: boolean;
  error?: string;
}

const initialState: LocationState = {
  current: undefined,
  status: 'idle',
  permissionGranted: false,
  error: undefined,
};

const locationSlice = createSlice({
  name: 'location',
  initialState,
  reducers: {
    updateLocation(state, action: PayloadAction<Coordinates>) {
      state.current = action.payload;
      state.status = 'active';
      state.error = undefined;
    },
    setGPSStatus(state, action: PayloadAction<GPSStatus>) {
      state.status = action.payload;
    },
    setPermissionGranted(state, action: PayloadAction<boolean>) {
      state.permissionGranted = action.payload;
    },
    setLocationError(state, action: PayloadAction<string | undefined>) {
      state.error = action.payload;
      if (action.payload) {
        state.status = 'error';
      }
    },
    resetLocation(state) {
      state.current = undefined;
      state.status = 'idle';
      state.error = undefined;
    },
  },
});

export const {
  updateLocation,
  setGPSStatus,
  setPermissionGranted,
  setLocationError,
  resetLocation,
} = locationSlice.actions;

export default locationSlice.reducer;

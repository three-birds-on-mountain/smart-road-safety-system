import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RoutePoint, Route, RouteSafetySummary, RouteState } from '../types/route';

const initialState: RouteState = {
  origin: null,
  destination: null,
  route: null,
  safetySummary: null,
  status: 'idle',
  error: null,
};

const routeSlice = createSlice({
  name: 'route',
  initialState,
  reducers: {
    setOrigin(state, action: PayloadAction<RoutePoint | null>) {
      state.origin = action.payload;
      // 清除現有路線（因為起點變了）
      state.route = null;
      state.safetySummary = null;
      state.status = 'idle';
      state.error = null;
    },

    setDestination(state, action: PayloadAction<RoutePoint | null>) {
      state.destination = action.payload;
      // 清除現有路線（因為終點變了）
      state.route = null;
      state.safetySummary = null;
      state.status = 'idle';
      state.error = null;
    },

    setRoute(state, action: PayloadAction<Route>) {
      state.route = action.payload;
      state.status = 'succeeded';
      state.error = null;
    },

    setSafetySummary(state, action: PayloadAction<RouteSafetySummary>) {
      state.safetySummary = action.payload;
    },

    setRouteLoading(state) {
      state.status = 'loading';
      state.error = null;
    },

    setRouteError(state, action: PayloadAction<string>) {
      state.status = 'failed';
      state.error = action.payload;
      state.route = null;
      state.safetySummary = null;
    },

    clearRoute(state) {
      state.origin = null;
      state.destination = null;
      state.route = null;
      state.safetySummary = null;
      state.status = 'idle';
      state.error = null;
    },
  },
});

export const {
  setOrigin,
  setDestination,
  setRoute,
  setSafetySummary,
  setRouteLoading,
  setRouteError,
  clearRoute,
} = routeSlice.actions;

export default routeSlice.reducer;

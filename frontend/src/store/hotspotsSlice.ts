import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { HotspotDetail, HotspotSummary, NearbyHotspot } from '../types/hotspot';

interface HotspotsState {
  items: HotspotSummary[];
  nearby: NearbyHotspot[];
  selectedHotspotId?: string;
  detailedHotspot?: HotspotDetail;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error?: string;
}

const initialState: HotspotsState = {
  items: [],
  nearby: [],
  selectedHotspotId: undefined,
  detailedHotspot: undefined,
  status: 'idle',
  error: undefined,
};

export const fetchNearbyHotspots = createAsyncThunk<NearbyHotspot[]>(
  'hotspots/fetchNearby',
  async () => {
    // Placeholder implementation - will connect to API in subsequent tasks.
    return [];
  },
);

const hotspotsSlice = createSlice({
  name: 'hotspots',
  initialState,
  reducers: {
    setHotspots(state, action: PayloadAction<HotspotSummary[]>) {
      state.items = action.payload;
    },
    setNearbyHotspots(state, action: PayloadAction<NearbyHotspot[]>) {
      state.nearby = action.payload;
    },
    selectHotspot(state, action: PayloadAction<string | undefined>) {
      state.selectedHotspotId = action.payload;
    },
    setHotspotDetail(state, action: PayloadAction<HotspotDetail | undefined>) {
      state.detailedHotspot = action.payload;
    },
    resetHotspotsState() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNearbyHotspots.pending, (state) => {
        state.status = 'loading';
        state.error = undefined;
      })
      .addCase(fetchNearbyHotspots.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.nearby = action.payload;
      })
      .addCase(fetchNearbyHotspots.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message ?? 'Failed to load nearby hotspots';
      });
  },
});

export const {
  setHotspots,
  setNearbyHotspots,
  selectHotspot,
  setHotspotDetail,
  resetHotspotsState,
} = hotspotsSlice.actions;

export default hotspotsSlice.reducer;

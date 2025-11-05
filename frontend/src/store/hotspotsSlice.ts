import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { apiClient } from '../services/api';
import type {
  HotspotDetail,
  HotspotListMeta,
  HotspotListResponse,
  HotspotSummary,
  NearbyHotspot,
} from '../types/hotspot';
import type { AccidentSeverity } from '../types/accident';

interface HotspotsState {
  items: HotspotSummary[];
  nearby: NearbyHotspot[];
  nearbyMeta?: HotspotListMeta;
  selectedHotspotId?: string;
  detailedHotspot?: HotspotDetail;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error?: string;
}

const initialState: HotspotsState = {
  items: [],
  nearby: [],
  nearbyMeta: undefined,
  selectedHotspotId: undefined,
  detailedHotspot: undefined,
  status: 'idle',
  error: undefined,
};

interface NearbyHotspotApi {
  id: string;
  center_latitude: number;
  center_longitude: number;
  radius_meters: number;
  total_accidents: number;
  a1_count: number;
  a2_count: number;
  a3_count: number;
  earliest_accident_at?: string;
  latest_accident_at?: string;
  severity_score?: number;
  distance_from_user_meters: number;
}

interface HotspotListMetaApi {
  total_count: number;
  query_radius_meters?: number;
  user_location?: {
    latitude: number;
    longitude: number;
  };
}

interface FetchNearbyParams {
  latitude: number;
  longitude: number;
  distanceMeters: number;
  severityLevels?: AccidentSeverity[];
  timeRange?: string;
  signal?: AbortSignal;
}

const adaptNearbyHotspot = (payload: NearbyHotspotApi): NearbyHotspot => ({
  id: payload.id,
  centerLatitude: payload.center_latitude,
  centerLongitude: payload.center_longitude,
  radiusMeters: payload.radius_meters,
  totalAccidents: payload.total_accidents,
  a1Count: payload.a1_count,
  a2Count: payload.a2_count,
  a3Count: payload.a3_count,
  earliestAccidentAt: payload.earliest_accident_at,
  latestAccidentAt: payload.latest_accident_at,
  severityScore: payload.severity_score,
  distanceFromUserMeters: payload.distance_from_user_meters,
});

export const fetchNearbyHotspots = createAsyncThunk<
  HotspotListResponse<NearbyHotspot>,
  FetchNearbyParams
>(
  'hotspots/fetchNearby',
  async ({ latitude, longitude, distanceMeters, severityLevels, timeRange, signal }) => {
    const params = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      distance: distanceMeters.toString(),
    });

    if (severityLevels?.length) {
      params.set('severity_levels', severityLevels.join(','));
    }

    if (timeRange) {
      params.set('time_range', timeRange);
    }

    const response = await apiClient.get<{
      data: NearbyHotspotApi[];
      meta: HotspotListMetaApi;
    }>(`/hotspots/nearby`, {
      params,
      signal,
    });

    return {
      data: response.data.data.map(adaptNearbyHotspot),
      meta: {
        totalCount: response.data.meta.total_count,
        queryRadiusMeters: response.data.meta.query_radius_meters,
        userLocation: response.data.meta.user_location,
      },
    };
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
        state.nearby = action.payload.data;
        state.nearbyMeta = action.payload.meta;
      })
      .addCase(fetchNearbyHotspots.rejected, (state, action) => {
        if (action.meta.aborted) {
          state.status = 'idle';
          return;
        }

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

export type { FetchNearbyParams };

export default hotspotsSlice.reducer;

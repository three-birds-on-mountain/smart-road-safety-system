import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { apiClient } from '../services/api';
import { getMockNearbyHotspots } from '../mocks/hotspots';
import type {
  HotspotDetail,
  HotspotListMeta,
  HotspotListResponse,
  HotspotSummary,
  NearbyHotspot,
} from '../types/hotspot';
import type { RootState } from '../store';
import type { TimeRangeOption } from '../types/settings';

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
  signal?: AbortSignal;
}

interface FetchInBoundsParams {
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
  signal?: AbortSignal;
}

const TIME_RANGE_QUERY: Record<TimeRangeOption, string> = {
  '1Y': '12_months',
  '6M': '6_months',
  '3M': '3_months',
  '1M': '1_month',
};

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

const adaptHotspotSummary = (payload: NearbyHotspotApi): HotspotSummary => ({
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
});

export const fetchNearbyHotspots = createAsyncThunk<
  HotspotListResponse<NearbyHotspot>,
  FetchNearbyParams,
  { state: RootState }
>(
  'hotspots/fetchNearby',
  async ({ latitude, longitude, signal }, { getState }) => {
    if (import.meta.env.VITE_USE_MOCK_API === 'true') {
      return getMockNearbyHotspots({ latitude, longitude, settings: getState().settings.current });
    }

    const {
      settings: {
        current: { distanceMeters, severityFilter, timeRange },
      },
    } = getState();

    const params = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      distance: distanceMeters.toString(),
    });

    if (severityFilter.length) {
      params.set('severity_levels', severityFilter.join(','));
    }

    const timeRangeQuery = TIME_RANGE_QUERY[timeRange];
    if (timeRangeQuery) {
      params.set('time_range', timeRangeQuery);
    }

    try {
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
    } catch (error) {
      if (import.meta.env.VITE_FALLBACK_TO_MOCK === 'true') {
        return getMockNearbyHotspots({ latitude, longitude, settings: getState().settings.current });
      }
      throw error;
    }
  },
);

export const fetchHotspotsInBounds = createAsyncThunk<
  HotspotListResponse<HotspotSummary>,
  FetchInBoundsParams,
  { state: RootState }
>(
  'hotspots/fetchInBounds',
  async ({ minLatitude, maxLatitude, minLongitude, maxLongitude, signal }, { getState }) => {
    const {
      settings: {
        current: { severityFilter, timeRange },
      },
    } = getState();

    const params = new URLSearchParams({
      min_latitude: minLatitude.toString(),
      max_latitude: maxLatitude.toString(),
      min_longitude: minLongitude.toString(),
      max_longitude: maxLongitude.toString(),
    });

    if (severityFilter.length) {
      params.set('severity_levels', severityFilter.join(','));
    }

    const timeRangeQuery = TIME_RANGE_QUERY[timeRange];
    if (timeRangeQuery) {
      params.set('time_range', timeRangeQuery);
    }

    const response = await apiClient.get<{
      data: NearbyHotspotApi[];
      meta: HotspotListMetaApi;
    }>(`/hotspots/in-bounds`, {
      params,
      signal,
    });

    return {
      data: response.data.data.map(adaptHotspotSummary),
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
      })
      .addCase(fetchHotspotsInBounds.pending, (state) => {
        state.status = 'loading';
        state.error = undefined;
      })
      .addCase(fetchHotspotsInBounds.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload.data;
      })
      .addCase(fetchHotspotsInBounds.rejected, (state, action) => {
        if (action.meta.aborted) {
          state.status = 'idle';
          return;
        }

        state.status = 'failed';
        state.error = action.error.message ?? 'Failed to load hotspots in bounds';
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

export type { FetchNearbyParams, FetchInBoundsParams };

export default hotspotsSlice.reducer;

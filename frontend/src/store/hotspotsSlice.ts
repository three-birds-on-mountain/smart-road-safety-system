import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { apiClient } from '../services/api';
import { getMockNearbyHotspots, getMockHotspotDetail, getMockAllHotspots } from '../mocks/hotspots';
import { mapSeverityLevelsToApi, mapTimeRangeToApi } from '../utils/mappers';
import type {
  HotspotDetail,
  HotspotListMeta,
  HotspotListResponse,
  HotspotSummary,
  NearbyHotspot,
} from '../types/hotspot';
import type { RootState } from '../store';
import type { AccidentSeverity } from '../types/accident';

interface HotspotsState {
  allHotspots: HotspotSummary[]; // 所有熱點資料（啟動時載入一次）
  items: HotspotSummary[]; // 地圖顯示的熱點（前端過濾）
  nearby: NearbyHotspot[]; // 警示用的附近熱點（前端過濾）
  nearbyMeta?: HotspotListMeta;
  selectedHotspotId?: string;
  detailedHotspot?: HotspotDetail;
  status: 'idle' | 'loading' | 'succeeded' | 'failed'; // 載入所有熱點的狀態
  error?: string;
  nearbyStatus: 'idle' | 'loading' | 'succeeded' | 'failed'; // 附近熱點狀態
  nearbyError?: string;
  detailStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  detailError?: string;
}

const initialState: HotspotsState = {
  allHotspots: [],
  items: [],
  nearby: [],
  nearbyMeta: undefined,
  selectedHotspotId: undefined,
  detailedHotspot: undefined,
  status: 'idle',
  error: undefined,
  nearbyStatus: 'idle',
  nearbyError: undefined,
  detailStatus: 'idle',
  detailError: undefined,
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

interface FetchHotspotDetailParams {
  hotspotId: string;
  signal?: AbortSignal;
}

export const adaptNearbyHotspot = (payload: NearbyHotspotApi): NearbyHotspot => ({
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

export const adaptHotspotSummary = (payload: NearbyHotspotApi): HotspotSummary => ({
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

interface HotspotDetailApi extends NearbyHotspotApi {
  analysis_date?: string;
  analysis_period_start?: string;
  analysis_period_end?: string;
  accidents?: Array<{
    id: string;
    latitude: number;
    longitude: number;
    occurred_at: string;
    severity: string;
    address?: string;
    distance_meters?: number;
    involved_people?: string[];
    involved_vehicles?: string[];
    description?: string;
  }>;
}

export const adaptHotspotDetail = (payload: HotspotDetailApi): HotspotDetail => ({
  ...adaptHotspotSummary(payload),
  distanceFromUserMeters: payload.distance_from_user_meters,
  analysisDate: payload.analysis_date,
  analysisPeriodStart: payload.analysis_period_start,
  analysisPeriodEnd: payload.analysis_period_end,
  accidents:
    payload.accidents?.map((accident) => ({
      id: accident.id,
      latitude: accident.latitude,
      longitude: accident.longitude,
      occurredAt: accident.occurred_at,
      severity: accident.severity as AccidentSeverity,
      address: accident.address,
      distanceMeters: accident.distance_meters,
      involvedPeople: accident.involved_people,
      involvedVehicles: accident.involved_vehicles,
      description: accident.description,
    })) ?? [],
});

export const fetchAllHotspots = createAsyncThunk<
  HotspotListResponse<HotspotSummary>,
  { signal?: AbortSignal } | void,
  { state: RootState }
>(
  'hotspots/fetchAll',
  async (params) => {
    const signal = params?.signal;

    if (import.meta.env.VITE_USE_MOCK_API === 'true') {
      return getMockAllHotspots();
    }

    try {
      const response = await apiClient.get<{
        data: NearbyHotspotApi[];
        meta: HotspotListMetaApi;
      }>(`/hotspots/all`, {
        params: { limit: 10000 },
        signal,
      });

      return {
        data: response.data.data.map(adaptHotspotSummary),
        meta: {
          totalCount: response.data.meta.total_count,
        },
      };
    } catch (error) {
      if (import.meta.env.VITE_FALLBACK_TO_MOCK === 'true') {
        return getMockAllHotspots();
      }
      throw error;
    }
  },
);

export const fetchHotspotDetail = createAsyncThunk<
  HotspotDetail,
  FetchHotspotDetailParams,
  { state: RootState }
>(
  'hotspots/fetchDetail',
  async ({ hotspotId, signal }) => {
    if (import.meta.env.VITE_USE_MOCK_API === 'true') {
      const mock = getMockHotspotDetail(hotspotId);
      if (mock) return mock;
    }

    try {
      const response = await apiClient.get<{ data: HotspotDetailApi }>(`/hotspots/${hotspotId}`, {
        params: { include_accidents: true },
        signal,
      });
      return adaptHotspotDetail(response.data.data);
    } catch (error) {
      if (
        import.meta.env.VITE_FALLBACK_TO_MOCK === 'true' ||
        (import.meta.env.DEV && import.meta.env.VITE_DISABLE_MOCK_PREVIEW !== 'true')
      ) {
        const mock = getMockHotspotDetail(hotspotId);
        if (mock) return mock;
      }
      throw error;
    }
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
      state.detailStatus = action.payload ? 'succeeded' : 'idle';
      state.detailError = undefined;
    },
    resetHotspotsState() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchAllHotspots 用於一次性載入所有熱點
      .addCase(fetchAllHotspots.pending, (state) => {
        state.status = 'loading';
        state.error = undefined;
      })
      .addCase(fetchAllHotspots.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.allHotspots = action.payload.data;
        state.items = action.payload.data; // 初始時顯示所有熱點
      })
      .addCase(fetchAllHotspots.rejected, (state, action) => {
        if (action.meta.aborted) {
          state.status = 'idle';
          return;
        }
        state.status = 'failed';
        state.error = action.error.message ?? 'Failed to load all hotspots';
      })
      .addCase(fetchHotspotDetail.pending, (state) => {
        state.detailStatus = 'loading';
        state.detailError = undefined;
      })
      .addCase(fetchHotspotDetail.fulfilled, (state, action) => {
        state.detailStatus = 'succeeded';
        state.detailedHotspot = action.payload;
      })
      .addCase(fetchHotspotDetail.rejected, (state, action) => {
        if (action.meta.aborted) {
          state.detailStatus = 'idle';
          return;
        }
        state.detailStatus = 'failed';
        state.detailError = action.error.message ?? 'Failed to load hotspot detail';
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

export type { FetchHotspotDetailParams };

export default hotspotsSlice.reducer;

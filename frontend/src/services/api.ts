import axios from 'axios';

export interface ApiErrorPayload {
  error?: string;
  message?: string;
  details?: Record<string, unknown>;
}

export class ApiError extends Error {
  status?: number;
  payload?: ApiErrorPayload | unknown;

  constructor(message: string, status?: number, payload?: ApiErrorPayload | unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

const baseURL = import.meta.env.VITE_API_BASE_URL;

if (!baseURL) {
  // eslint-disable-next-line no-console
  console.warn('VITE_API_BASE_URL is not set. API requests will likely fail.');
}

export const apiClient = axios.create({
  baseURL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const { response } = error;
    if (response) {
      const payload = response.data as ApiErrorPayload | undefined;
      const status = response.status;
      if (status === 422) {
        const message = payload?.message ?? '請求參數不正確，請確認輸入格式。';
        return Promise.reject(new ApiError(message, status, payload));
      }

      const fallbackMessage =
        payload?.message ?? `伺服器回應錯誤 (${status})，請稍後再試。`;
      const wrappedError = new ApiError(fallbackMessage, status, payload);
      return Promise.reject(wrappedError);
    }
    return Promise.reject(
      new ApiError('無法連線至伺服器，請檢查網路後重試。', undefined, undefined),
    );
  },
);

export const setAuthToken = (token?: string) => {
  if (token) {
    apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common.Authorization;
  }
};

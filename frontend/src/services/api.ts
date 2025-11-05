import axios from 'axios';

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
    if (error.response) {
      // eslint-disable-next-line no-console
      console.error(
        `API error: ${error.response.status} ${error.response.statusText}`,
        error.response.data,
      );
    }
    return Promise.reject(error);
  },
);

export const setAuthToken = (token?: string) => {
  if (token) {
    apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common.Authorization;
  }
};

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const defaultBaseURL =
  'https://vprotech-student-faculty-system1.onrender.com/api';

const baseURL =
  process.env.EXPO_PUBLIC_API_URL?.trim() || defaultBaseURL;

console.log('API BASE URL:', baseURL);

const API = axios.create({
  baseURL,
  timeout: 15000,
  headers: {
    Accept: 'application/json',
  },
});

API.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('token');

      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }

      /*
       * IMPORTANT:
       * Do NOT manually set multipart/form-data here.
       *
       * Axios needs to generate the multipart boundary
       * automatically for FormData requests.
       */

      if (!(config.data instanceof FormData)) {
        config.headers = config.headers || {};
        config.headers['Content-Type'] = 'application/json';
      } else {
        if (config.headers) {
          delete config.headers['Content-Type'];
          delete config.headers['content-type'];
        }
      }

      if (__DEV__) {
        console.log('API REQUEST:', {
          method: config.method?.toUpperCase(),
          url: `${config.baseURL || ''}${config.url || ''}`,
          hasToken: !!token,
          isFormData: config.data instanceof FormData,
        });
      }

      return config;
    } catch (error) {
      console.error(
        'API REQUEST INTERCEPTOR ERROR:',
        error
      );

      return config;
    }
  },
  (error) => Promise.reject(error)
);

API.interceptors.response.use(
  (response) => {
    if (__DEV__) {
      console.log('API RESPONSE:', {
        status: response.status,
        url: `${response.config?.baseURL || ''}${response.config?.url || ''}`,
      });
    }

    return response;
  },

  (error) => {
    const status = error?.response?.status;
    const data = error?.response?.data;
    const config = error?.config;

    console.error('API ERROR:', {
      status,
      data,
      method: config?.method?.toUpperCase(),
      url: `${config?.baseURL || ''}${config?.url || ''}`,
    });

    if (status === 401) {
      console.warn(
        'AUTHENTICATION ERROR:',
        data?.message || 'Authentication failed.'
      );
    }

    if (status === 403) {
      console.warn(
        'PERMISSION ERROR:',
        data?.message || 'Access denied.'
      );
    }

    if (status === 404) {
      console.warn(
        'NOT FOUND:',
        data?.message || 'Requested API endpoint was not found.'
      );
    }

    if (status === 429) {
      console.warn(
        'RATE LIMIT ERROR:',
        data?.message || 'Too many requests.'
      );
    }

    if (status >= 500) {
      console.error(
        'SERVER ERROR:',
        data?.message || 'Internal server error.'
      );
    }

    return Promise.reject(error);
  }
);

export default API;
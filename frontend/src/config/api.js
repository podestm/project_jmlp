// API Configuration
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_BASE || '',
  ENDPOINTS: {
    RACES: '/races/',
    POSTS: '/posts/',
    CLUBS: '/clubs/',
    RACERS: '/racers/',
    REGISTRATIONS: '/registrations/'
  },
  DEFAULT_HEADERS: {
    'Content-Type': 'application/json',
  }
};

import {
  applyLocalMutation,
  cacheGetResponse,
  enqueueMutation,
  processSyncQueue,
  readCachedResponse,
  startSyncLoop
} from '../offline/timekeeperOffline.js';

// Helper to build URL with query params
const buildUrl = (endpoint, params = {}) => {
  // Normalize endpoint to ensure it starts with /
  const normalized = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  // If BASE_URL is empty, use relative URL
  if (!API_CONFIG.BASE_URL) {
    const paramStr = Object.keys(params)
      .filter(key => params[key] !== undefined && params[key] !== null)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&');
    return paramStr ? `${normalized}?${paramStr}` : normalized;
  }
  
  // Otherwise use absolute URL with URL constructor
  const url = new URL(`${API_CONFIG.BASE_URL}${normalized}`);
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null) {
      url.searchParams.append(key, params[key]);
    }
  });
  return url.toString();
};

// API Helper Functions
export const API = {
  get: async (endpoint, params = {}, customHeaders = {}) => {
    const url = buildUrl(endpoint, params);

    const response = await fetch(url, {
      method: 'GET',
      headers: { ...API_CONFIG.DEFAULT_HEADERS, ...customHeaders },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  },
  
  getImageUrl: (postId, updatedAt) => {
    const timestamp = updatedAt ? new Date(updatedAt).getTime() : Date.now();
    return buildUrl(`/posts/${postId}/image`, { v: timestamp });
  },
  
  getDocumentUrl: (postId) => {
    return buildUrl(`/posts/${postId}/document/download`);
  },

  post: async (endpoint, data = {}, customHeaders = {}) => {
    const url = buildUrl(endpoint);
    const response = await fetch(url, {
      method: 'POST',
      headers: { ...API_CONFIG.DEFAULT_HEADERS, ...customHeaders },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  },

  put: async (endpoint, data = {}, customHeaders = {}) => {
    const url = buildUrl(endpoint);
    const response = await fetch(url, {
      method: 'PUT',
      headers: { ...API_CONFIG.DEFAULT_HEADERS, ...customHeaders },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  },

  delete: async (endpoint, customHeaders = {}) => {
    const url = buildUrl(endpoint);
    const response = await fetch(url, {
      method: 'DELETE',
      headers: { ...API_CONFIG.DEFAULT_HEADERS, ...customHeaders },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  },

  // File upload helper
  upload: async (endpoint, formData, customHeaders = {}) => {
    const url = buildUrl(endpoint);
    // Don't set Content-Type for FormData - let browser set it with boundary
    const headers = { ...customHeaders };
    delete headers['Content-Type'];

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }
};

// Helper function to handle auth errors
const handleAuthError = (status) => {
  if (status === 401) {
    // Clear token and redirect to login only for 401 (token invalid/expired)
    localStorage.removeItem('admin_token');
    if (window.location.pathname.startsWith('/admin') && window.location.pathname !== '/admin/login') {
      window.location.href = '/admin';
    }
  }
  // 403 môže byť aj iný problém než neplatný token, takže nemazať token automaticky
};

// Timekeeper auth error handler
const handleTimekeeperAuthError = (status) => {
  if (status === 401) {
    localStorage.removeItem('timekeeper_token');
    if (window.location.pathname.startsWith('/timekeeper') && window.location.pathname !== '/timekeeper/login') {
      window.location.href = '/timekeeper';
    }
  }
};

// Admin API with authentication
export const AdminAPI = {
  get: async (endpoint, params = {}) => {
    const token = localStorage.getItem('admin_token');
    const url = buildUrl(endpoint, params);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...API_CONFIG.DEFAULT_HEADERS,
        Authorization: token ? `Bearer ${token}` : ''
      },
      redirect: 'follow'
    });

    if (!response.ok) {
      handleAuthError(response.status);
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  },

  post: async (endpoint, data = {}) => {
    const token = localStorage.getItem('admin_token');
    const url = buildUrl(endpoint);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...API_CONFIG.DEFAULT_HEADERS,
        Authorization: token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify(data),
      redirect: 'follow'
    });

    if (!response.ok) {
      handleAuthError(response.status);
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  },

  put: async (endpoint, data = {}) => {
    const token = localStorage.getItem('admin_token');
    const url = buildUrl(endpoint);
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        ...API_CONFIG.DEFAULT_HEADERS,
        Authorization: token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify(data),
      redirect: 'follow'
    });

    if (!response.ok) {
      handleAuthError(response.status);
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  },

  delete: async (endpoint) => {
    const token = localStorage.getItem('admin_token');
    const url = buildUrl(endpoint);
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        ...API_CONFIG.DEFAULT_HEADERS,
        Authorization: token ? `Bearer ${token}` : ''
      },
      redirect: 'follow'
    });

    if (!response.ok) {
      handleAuthError(response.status);
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  },
  
  upload: async (endpoint, formData) => {
    const token = localStorage.getItem('admin_token');
    const url = buildUrl(endpoint);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: token ? `Bearer ${token}` : ''
      },
      body: formData,
      redirect: 'follow'
    });

    if (!response.ok) {
      handleAuthError(response.status);
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }
};

// Timekeeper API with authentication (separate token)
const extractStatusFromError = (error) => {
  if (typeof error?.status === 'number') return error.status;
  if (!error?.message) return null;
  const match = error.message.match(/API Error: (\d+)/);
  return match ? parseInt(match[1], 10) : null;
};

const isNetworkError = (error) => {
  const message = error?.message || '';
  return (
    message.includes('Failed to fetch') ||
    message.includes('NetworkError') ||
    message.includes('Load failed')
  );
};

const isAuthError = (status) => status === 401 || status === 403;

const timekeeperFetch = async (method, endpoint, data = null, params = null, extraHeaders = {}) => {
  const token = localStorage.getItem('timekeeper_token');
  const url = buildUrl(endpoint, params || {});

  const response = await fetch(url, {
    method,
    headers: {
      ...API_CONFIG.DEFAULT_HEADERS,
      Authorization: token ? `Bearer ${token}` : '',
      ...extraHeaders
    },
    ...(data != null ? { body: JSON.stringify(data) } : {}),
    redirect: 'follow'
  });

  if (!response.ok) {
    handleTimekeeperAuthError(response.status);
    let parsedDetail = null;
    try {
      parsedDetail = await response.json();
    } catch {
      parsedDetail = null;
    }

    const error = new Error(`API Error: ${response.status} ${response.statusText}`);
    error.status = response.status;
    error.detail = parsedDetail?.detail || parsedDetail || null;
    throw error;
  }

  return response.json();
};

const TimekeeperAPIOnline = {
  get: async (endpoint, params = {}) => timekeeperFetch('GET', endpoint, null, params),
  post: async (endpoint, data = {}, meta = {}) => timekeeperFetch('POST', endpoint, data, null, meta.headers || {}),
  put: async (endpoint, data = {}, meta = {}) => timekeeperFetch('PUT', endpoint, data, null, meta.headers || {}),
  delete: async (endpoint, meta = {}) => timekeeperFetch('DELETE', endpoint, null, null, meta.headers || {})
};

const queueMutationWithLocalApply = async (method, endpoint, data = null) => {
  await applyLocalMutation(method, endpoint, data);
  await enqueueMutation(method, endpoint, data);
  return {
    queued: true,
    offline: true,
    message: 'Změna byla uložena lokálně a čeká na synchronizaci.'
  };
};

const syncExecutor = async (item) => {
  const method = (item.method || '').toUpperCase();
  const headers = item.op_id ? { 'X-Idempotency-Key': item.op_id } : {};
  if (method === 'POST') {
    await TimekeeperAPIOnline.post(item.endpoint, item.payload || {}, { headers });
    return;
  }
  if (method === 'PUT') {
    await TimekeeperAPIOnline.put(item.endpoint, item.payload || {}, { headers });
    return;
  }
  if (method === 'DELETE') {
    await TimekeeperAPIOnline.delete(item.endpoint, { headers });
  }
};

startSyncLoop(syncExecutor);

export const TimekeeperAPI = {
  get: async (endpoint, params = {}) => {
    const canUseNetwork = typeof navigator === 'undefined' ? true : navigator.onLine;

    if (canUseNetwork) {
      try {
        const data = await TimekeeperAPIOnline.get(endpoint, params);
        await cacheGetResponse(endpoint, params, data);
        return data;
      } catch (error) {
        const status = extractStatusFromError(error);
        if (status && isAuthError(status)) {
          throw error;
        }

        const cached = await readCachedResponse(endpoint, params);
        if (cached != null) {
          return cached;
        }

        throw error;
      }
    }

    const cached = await readCachedResponse(endpoint, params);
    if (cached != null) {
      return cached;
    }

    throw new Error('Offline režim: data nejsou dostupná v lokální cache.');
  },

  post: async (endpoint, data = {}) => {
    const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
    if (!isOnline) {
      return queueMutationWithLocalApply('POST', endpoint, data);
    }

    try {
      return await TimekeeperAPIOnline.post(endpoint, data);
    } catch (error) {
      const status = extractStatusFromError(error);
      if (status && isAuthError(status)) {
        throw error;
      }
      if (isNetworkError(error)) {
        return queueMutationWithLocalApply('POST', endpoint, data);
      }
      throw error;
    }
  },

  put: async (endpoint, data = {}) => {
    const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
    if (!isOnline) {
      return queueMutationWithLocalApply('PUT', endpoint, data);
    }

    try {
      const result = await TimekeeperAPIOnline.put(endpoint, data);
      await applyLocalMutation('PUT', endpoint, data);
      return result;
    } catch (error) {
      const status = extractStatusFromError(error);
      if (status && isAuthError(status)) {
        throw error;
      }
      if (isNetworkError(error)) {
        return queueMutationWithLocalApply('PUT', endpoint, data);
      }
      throw error;
    }
  },

  delete: async (endpoint) => {
    const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
    if (!isOnline) {
      return queueMutationWithLocalApply('DELETE', endpoint, null);
    }

    try {
      return await TimekeeperAPIOnline.delete(endpoint);
    } catch (error) {
      const status = extractStatusFromError(error);
      if (status && isAuthError(status)) {
        throw error;
      }
      if (isNetworkError(error)) {
        return queueMutationWithLocalApply('DELETE', endpoint, null);
      }
      throw error;
    }
  },

  flushQueue: async () => {
    await processSyncQueue(syncExecutor);
  }
};

export default API;
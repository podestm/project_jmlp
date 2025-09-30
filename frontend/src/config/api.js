// API Configuration
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_BASE || 'http://localhost:8000',
  ENDPOINTS: {
    RACES: '/races',
    POSTS: '/posts',
    CLUBS: '/clubs',
    RACERS: '/racers',
    REGISTRATIONS: '/registrations'
  },
  DEFAULT_HEADERS: {
    'Content-Type': 'application/json',
  }
};

// API Helper Functions
export const API = {
  get: async (endpoint, params = {}, customHeaders = {}) => {
    const url = new URL(`${API_CONFIG.BASE_URL}${endpoint}`);
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null) {
        url.searchParams.append(key, params[key]);
      }
    });

    const response = await fetch(url, {
      method: 'GET',
      headers: { ...API_CONFIG.DEFAULT_HEADERS, ...customHeaders },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  },

  post: async (endpoint, data = {}, customHeaders = {}) => {
    const response = await fetch(`${API_CONFIG.BASE_URL}${endpoint}`, {
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
    const response = await fetch(`${API_CONFIG.BASE_URL}${endpoint}`, {
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
    const response = await fetch(`${API_CONFIG.BASE_URL}${endpoint}`, {
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
    // Don't set Content-Type for FormData - let browser set it with boundary
    const headers = { ...customHeaders };
    delete headers['Content-Type'];

    const response = await fetch(`${API_CONFIG.BASE_URL}${endpoint}`, {
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

// Admin API with authentication
export const AdminAPI = {
  get: async (endpoint, params = {}) => {
    const token = localStorage.getItem('admin_token');
    const url = new URL(`${API_CONFIG.BASE_URL}${endpoint}`);
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null) {
        url.searchParams.append(key, params[key]);
      }
    });

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...API_CONFIG.DEFAULT_HEADERS,
        Authorization: token ? `Bearer ${token}` : ''
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  },

  post: async (endpoint, data = {}) => {
    const token = localStorage.getItem('admin_token');
    const response = await fetch(`${API_CONFIG.BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        ...API_CONFIG.DEFAULT_HEADERS,
        Authorization: token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  },

  put: async (endpoint, data = {}) => {
    const token = localStorage.getItem('admin_token');
    const response = await fetch(`${API_CONFIG.BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: {
        ...API_CONFIG.DEFAULT_HEADERS,
        Authorization: token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  },

  delete: async (endpoint) => {
    const token = localStorage.getItem('admin_token');
    const response = await fetch(`${API_CONFIG.BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: {
        ...API_CONFIG.DEFAULT_HEADERS,
        Authorization: token ? `Bearer ${token}` : ''
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }
};

export default API;
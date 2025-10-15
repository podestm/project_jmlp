// API Configuration
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_BASE || '',
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
  if (status === 401 || status === 403) {
    // Clear token and redirect to login
    localStorage.removeItem('admin_token');
    if (window.location.pathname.startsWith('/admin') && window.location.pathname !== '/admin/login') {
      window.location.href = '/admin';
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

export default API;
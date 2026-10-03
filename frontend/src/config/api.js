// API Configuration
import { migrateLegacySession, SESSION_TOKEN_KEY } from './session.js';

// Tokeny ze starších verzí (admin_token, timekeeper_token) -> společné přihlášení.
migrateLegacySession();

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

// Helper to build URL with query params
export const buildUrl = (endpoint, params = {}) => {
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

// Generic Czech fallbacks used when the backend sends no `detail`.
const STATUS_MESSAGES = {
  400: 'Neplatný požadavek.',
  401: 'Přihlášení vypršelo, přihlaste se znovu.',
  403: 'Nemáte oprávnění k této akci.',
  404: 'Požadovaná data nebyla nalezena.',
  409: 'Data byla mezitím změněna jinde.',
  413: 'Soubor je příliš velký.',
  422: 'Zadaná data nejsou platná.'
};

const statusMessage = (status, statusText) => {
  if (STATUS_MESSAGES[status]) return STATUS_MESSAGES[status];
  if (status >= 500) return 'Chyba serveru, zkuste to prosím znovu.';
  return `API Error: ${status} ${statusText}`;
};

// Reads the backend's `detail` so components can show the Czech message
// instead of a bare status line. Returns null when there is no usable body.
const readErrorDetail = async (response) => {
  try {
    const body = await response.json();
    const detail = body?.detail ?? body;
    if (typeof detail === 'string') return detail;
    // FastAPI validation errors arrive as a list of {loc, msg, type}
    if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
    return null;
  } catch {
    return null;
  }
};

// `status` and `detail` are load-bearing: the offline sync queue branches on
// them (see config/timekeeperApi.js and offline/timekeeperOffline.js).
const buildApiError = (response, detail) => {
  const error = new Error(detail || statusMessage(response.status, response.statusText));
  error.status = response.status;
  error.statusText = response.statusText;
  error.detail = detail;
  return error;
};

/**
 * Builds an HTTP client. All four verbs plus `upload` share one request path,
 * so error handling and auth stay defined in exactly one place.
 *
 * @param {function} [getAuthHeaders] - extra headers per request (e.g. Bearer token)
 * @param {function} [onError] - called with the HTTP status before the throw
 */
const createHttpClient = ({ getAuthHeaders, onError, redirect } = {}) => {
  const request = async (method, endpoint, { params, body, headers } = {}) => {
    const isForm = body instanceof FormData;
    const mergedHeaders = {
      ...(isForm ? {} : API_CONFIG.DEFAULT_HEADERS),
      ...(getAuthHeaders ? getAuthHeaders() : {}),
      ...headers
    };
    // The browser must set Content-Type itself so the multipart boundary is correct.
    if (isForm) delete mergedHeaders['Content-Type'];

    const response = await fetch(buildUrl(endpoint, params || {}), {
      method,
      headers: mergedHeaders,
      ...(body != null ? { body: isForm ? body : JSON.stringify(body) } : {}),
      ...(redirect ? { redirect } : {})
    });

    if (!response.ok) {
      if (onError) onError(response.status);
      throw buildApiError(response, await readErrorDetail(response));
    }

    return response.json();
  };

  return {
    request,
    get: (endpoint, params = {}, headers = {}) => request('GET', endpoint, { params, headers }),
    post: (endpoint, data = {}, headers = {}) => request('POST', endpoint, { body: data, headers }),
    put: (endpoint, data = {}, headers = {}) => request('PUT', endpoint, { body: data, headers }),
    delete: (endpoint, headers = {}, params = {}) => request('DELETE', endpoint, { headers, params }),
    upload: (endpoint, formData, headers = {}) => request('POST', endpoint, { body: formData, headers })
  };
};

/**
 * Stažení binárky (PDF, CSV, ZIP).
 *
 * Klient výše končí `response.json()`, takže binárka jím projít nemůže.
 * Dřív si to každé místo řešilo vlastním raw fetchem - tohle je jedna kopie.
 */
export const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

export const fetchBlob = async (endpoint, { params = {}, headers = {} } = {}) => {
  const response = await fetch(buildUrl(endpoint, params), { headers });
  if (!response.ok) {
    throw buildApiError(response, await readErrorDetail(response));
  }
  return response.blob();
};

// Public API - no authentication
export const API = {
  ...createHttpClient(),

  getImageUrl: (postId, updatedAt) => {
    const timestamp = updatedAt ? new Date(updatedAt).getTime() : Date.now();
    return buildUrl(`/posts/${postId}/image`, { v: timestamp });
  },

  getDocumentUrl: (postId) => buildUrl(`/posts/${postId}/document/download`)
};

/**
 * Událost "vypršelo přihlášení". Existuje proto, že tvrdý `window.location.href`
 * je v časoměřičské sekci nepoužitelný: reload zavře otevřený Web Serial port
 * časomíry a rozjetý závod přijde o měření. Kdo umí odhlásit uživatele bez
 * navigace (React kontext), si na tuhle událost počká.
 *
 * `detail.section` říká, které sekce se to týká ('/admin' | '/timekeeper'),
 * `detail.tokenCleared` jestli už token z localStorage zmizel.
 */
export const AUTH_EXPIRED_EVENT = 'jmlp-auth-expired';

const emitAuthExpired = (section, tokenCleared) => {
  // Bez window (test/SSR) není kam událost poslat.
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, { detail: { section, tokenCleared } }));
};

/**
 * On 401 the token is invalid/expired - clear it and bounce to the login screen.
 * 403 is left alone: it can mean "logged in but not allowed", where dropping
 * the token would log the user out for no reason.
 *
 * @param {boolean} [options.inPlace] místo přesměrování prohlížeče jen vyšle
 *   AUTH_EXPIRED_EVENT - pro sekce, kde reload stránky něco rozbije (časoměřič
 *   a jeho Web Serial port).
 *
 * Vrácená obsluha bere druhý argument:
 * @param {boolean} [meta.background] požadavek na pozadí (sync fronta), na který
 *   nikdo nečeká. Takový 401 nesmí uživatele odhlásit ani nikam navigovat -
 *   jen se ohlásí událostí, aby UI mohlo nabídnout nové přihlášení. Token se
 *   schválně NEMAŽE: fronta se s ním po novém přihlášení dosynchronizuje.
 */
const createAuthErrorHandler = (tokenKey, sectionPath, { inPlace = false } = {}) =>
  (status, { background = false } = {}) => {
    if (status !== 401) return;

    if (background) {
      emitAuthExpired(sectionPath, false);
      return;
    }

    localStorage.removeItem(tokenKey);
    localStorage.removeItem(`${tokenKey}_expires_at`);
    const { pathname } = window.location;
    if (pathname.startsWith(sectionPath) && pathname !== `${sectionPath}/login`) {
      if (inPlace) {
        emitAuthExpired(sectionPath, true);
        return;
      }
      window.location.href = sectionPath;
    }
  };

// Administrace i časomíra mají jedno společné přihlášení (config/session.js).
export const handleAdminAuthError = createAuthErrorHandler(SESSION_TOKEN_KEY, '/admin');
export const handleTimekeeperAuthError = createAuthErrorHandler(SESSION_TOKEN_KEY, '/timekeeper', { inPlace: true });

const bearer = (tokenKey) => () => {
  const token = localStorage.getItem(tokenKey);
  return { Authorization: token ? `Bearer ${token}` : '' };
};

export const adminAuthHeaders = bearer(SESSION_TOKEN_KEY);
export const timekeeperAuthHeaders = bearer(SESSION_TOKEN_KEY);

// Admin API with authentication
export const AdminAPI = createHttpClient({
  getAuthHeaders: adminAuthHeaders,
  onError: handleAdminAuthError,
  redirect: 'follow'
});

export default API;

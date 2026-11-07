// Shared primitives for the two auth contexts (admin + timekeeper).
// Only the token/expiry state machine and the login round-trip are shared -
// the two providers keep their own offline contracts, which genuinely differ.
import API from './api.js';

/**
 * Token + expiry storage for one section of the app.
 * @param {string} tokenKey - localStorage key holding the JWT
 */
export const createTokenStore = (tokenKey) => {
  const expKey = `${tokenKey}_expires_at`;

  return {
    getToken: () => localStorage.getItem(tokenKey),

    isExpired: () => {
      const raw = localStorage.getItem(expKey);
      if (!raw) return false;
      const exp = Number(raw);
      return Number.isFinite(exp) && Date.now() >= exp;
    },

    save: (accessToken, expiresIn) => {
      localStorage.setItem(tokenKey, accessToken);
      if (Number.isFinite(expiresIn)) {
        localStorage.setItem(expKey, String(Date.now() + expiresIn * 1000));
      } else {
        localStorage.removeItem(expKey);
      }
    },

    clear: () => {
      localStorage.removeItem(tokenKey);
      localStorage.removeItem(expKey);
    },
  };
};

/**
 * Log in and fetch the profile in one step.
 * @returns {Promise<{access_token: string, user: object}>}
 */
export const loginWithCredentials = async ({
  loginEndpoint,
  meEndpoint,
  store,
  email,
  password,
}) => {
  const { access_token, expires_in } = await API.post(loginEndpoint, { email, password });
  store.save(access_token, expires_in);

  const user = await API.get(meEndpoint, {}, { Authorization: `Bearer ${access_token}` });
  return { access_token, user };
};

export const fetchProfile = (meEndpoint, token) =>
  API.get(meEndpoint, {}, { Authorization: `Bearer ${token}` });

export const isNetworkError = (error) => {
  const message = error?.message || '';
  return (
    message.includes('Failed to fetch') ||
    message.includes('NetworkError') ||
    message.includes('Load failed')
  );
};

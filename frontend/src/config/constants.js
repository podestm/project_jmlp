// Application Constants
export const APP_CONFIG = {
  NAME: 'JMLP',
  FULL_NAME: 'Jihomoravský lyžařský pohár',
  VERSION: '1.0.0',
  DESCRIPTION: 'Oficiální webové stránky Jihomoravského lyžařského poháru',
  
  // Contact Information
  CONTACT: {
    EMAIL: 'info@jmlp.cz',
    PHONE: '+420 123 456 789',
    ADDRESS: 'Brno, Česká republika'
  },
  
  // Social Media
  SOCIAL: {
    FACEBOOK: 'https://facebook.com/jmlp',
    INSTAGRAM: 'https://instagram.com/jmlp',
    YOUTUBE: 'https://youtube.com/jmlp'
  }
};

// Navigation Configuration
export const NAVIGATION = {
  MAIN: [
    { key: 'uvod', label: 'Úvod', icon: 'bi-house' },
    { key: 'terminovka', label: 'Termínovka', icon: 'bi-calendar-event' },
    { key: 'archiv', label: 'Archiv', icon: 'bi-archive' },
    { key: 'dokumenty', label: 'Dokumenty', icon: 'bi-file-text' },
    { key: 'kontakty', label: 'Kontakty', icon: 'bi-envelope' },
    { key: 'sutezni-rady', label: 'Soutěžní řády', icon: 'bi-book' },
    { key: 'admin', label: 'Admin', icon: 'bi-gear' }
  ]
};

// Race Configuration
export const RACE_CONFIG = {
  CURRENT_SEASON_ID: 14,
  RACE_TYPES: {
    1: 'Slalom',
    2: 'Obří slalom',
    3: 'Super G',
    4: 'Sjezd',
    5: 'Kombinace',
    6: 'Paralelní slalom',
    7: 'Snowboard'
  },
  RACE_CATEGORIES: {
    1: 'Dětská',
    2: 'Žákovská', 
    3: 'Juniorská',
    4: 'Seniorská'
  },
  RACE_METHODS: {
    1: 'Jeden jízda',
    2: 'Dvě jízdy'
  }
};

// Date and Time Configuration
export const DATE_CONFIG = {
  LOCALE: 'cs-CZ',
  DATE_FORMAT: {
    SHORT: { day: '2-digit', month: '2-digit', year: 'numeric' },
    LONG: { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    },
    MONTH_YEAR: { month: 'long', year: 'numeric' }
  },
  TIME_FORMAT: {
    SHORT: { hour: '2-digit', minute: '2-digit' },
    LONG: { hour: '2-digit', minute: '2-digit', second: '2-digit' }
  }
};

// UI Configuration
export const UI_CONFIG = {
  PAGINATION: {
    DEFAULT_PAGE_SIZE: 10,
    PAGE_SIZE_OPTIONS: [5, 10, 20, 50]
  },
  BREAKPOINTS: {
    SM: 576,
    MD: 768,
    LG: 992,
    XL: 1200
  },
  DELAYS: {
    DEBOUNCE: 300,
    TOAST: 5000,
    LOADING: 500
  }
};

// Feature Flags
export const FEATURES = {
  REGISTRATION_ENABLED: true,
  ADMIN_PANEL: true,
  SOCIAL_LOGIN: false,
  NOTIFICATIONS: true,
  DARK_MODE: false
};

export default {
  APP_CONFIG,
  NAVIGATION,
  RACE_CONFIG,
  DATE_CONFIG,
  UI_CONFIG,
  FEATURES
};
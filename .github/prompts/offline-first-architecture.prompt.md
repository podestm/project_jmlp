---
description: "Analyze project architecture and design offline-first solutions for unstable network environments"
name: "Offline-First Architecture Review"
agent: "agent"
tools: ["search", "file"]
---

# Offline-First Architecture Review

Analyze the current project architecture and design an offline-first solution for the **timekeeper** module that must work in environments with unstable internet connectivity.

## Requirements

The timekeeper module must:

1. **Work offline** - All core functionality available without network
2. **Handle intermittent connectivity** - Seamless transition between online/offline
3. **Never crash mid-race** - Data integrity is critical
4. **Auto-sync when online** - Queue changes and publish when connected
5. **Provide backups** - Export/import local data

## Analysis Tasks

### 1. Current Architecture Audit

Examine the timekeeper frontend components in `frontend/src/components/timekeeper/`:
- Identify all API calls and data dependencies
- Map state management patterns
- Find existing offline capabilities (localStorage, etc.)

### 2. Backend API Review

Review `backend/app/routers/timekeeper/`:
- List all endpoints the timekeeper uses
- Identify which operations can be batched
- Note any real-time dependencies

### 3. Data Flow Analysis

Document the critical workflows:
- Loading registration data → creating start list
- Recording race times (time1, time2, dnf, dns, dsq)
- Publishing results to public web

## Recommended Architecture

### Local Database (IndexedDB with Dexie.js)

```javascript
// frontend/src/offline/db.js
import Dexie from 'dexie';

const db = new Dexie('TimekeeperDB');

db.version(1).stores({
  races: 'id, datum, status',
  startList: 'id, race_id, racer_id, [race_id+start_number]',
  syncQueue: '++id, operation, endpoint, data, timestamp, status',
  settings: 'key'
});
```

### Sync Service Pattern

```javascript
// frontend/src/offline/syncService.js
class SyncService {
  // Queue operations when offline
  async queueOperation(operation, endpoint, data) {
    await db.syncQueue.add({
      operation,
      endpoint,
      data,
      timestamp: Date.now(),
      status: 'pending'
    });
  }

  // Process queue when online
  async processQueue() {
    const pending = await db.syncQueue
      .where('status').equals('pending')
      .sortBy('timestamp');
    
    for (const item of pending) {
      try {
        await this.executeOperation(item);
        await db.syncQueue.update(item.id, { status: 'completed' });
      } catch (error) {
        await db.syncQueue.update(item.id, { 
          status: 'failed', 
          error: error.message 
        });
      }
    }
  }
}
```

### Offline-Aware API Wrapper

```javascript
// frontend/src/offline/offlineAPI.js
export const OfflineTimekeeperAPI = {
  async get(endpoint, params = {}) {
    if (navigator.onLine) {
      try {
        const data = await TimekeeperAPI.get(endpoint, params);
        await this.cacheData(endpoint, data);
        return data;
      } catch (error) {
        return this.getCachedData(endpoint);
      }
    }
    return this.getCachedData(endpoint);
  },

  async put(endpoint, data) {
    // Always write locally first
    await this.saveLocally(endpoint, data);
    
    if (navigator.onLine) {
      try {
        return await TimekeeperAPI.put(endpoint, data);
      } catch (error) {
        await syncService.queueOperation('put', endpoint, data);
        return { queued: true };
      }
    } else {
      await syncService.queueOperation('put', endpoint, data);
      return { queued: true };
    }
  }
};
```

### Service Worker for App Shell

```javascript
// frontend/public/sw.js
const CACHE_NAME = 'timekeeper-v1';
const STATIC_ASSETS = [
  '/',
  '/timekeeper/',
  '/timekeeper/start-list',
  '/timekeeper/timing',
  '/timekeeper/results',
  // CSS and JS bundles
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/')) {
    // Network-first for API calls
    event.respondWith(networkFirst(event.request));
  } else {
    // Cache-first for static assets
    event.respondWith(cacheFirst(event.request));
  }
});
```

### React Context for Online Status

```jsx
// frontend/src/offline/OnlineStatusContext.jsx
export const OnlineStatusProvider = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState('idle'); // idle, syncing, error
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncService.processQueue();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <OnlineStatusContext.Provider value={{ isOnline, syncStatus, pendingCount }}>
      {children}
    </OnlineStatusContext.Provider>
  );
};
```

## Implementation Checklist

- [ ] Install Dexie.js: `npm install dexie`
- [ ] Create IndexedDB schema for timekeeper data
- [ ] Implement sync queue with retry logic
- [ ] Wrap TimekeeperAPI with offline-aware layer
- [ ] Add Service Worker for app shell caching
- [ ] Create OnlineStatus React context
- [ ] Add visual indicator in TimekeeperLayout (online/offline/syncing)
- [ ] Implement data export/import for manual backup
- [ ] Add conflict resolution for concurrent edits
- [ ] Test with Chrome DevTools Network throttling

## Output

Provide:
1. **Gap analysis** - What's missing in current architecture
2. **Migration plan** - Step-by-step implementation order
3. **Risk assessment** - Potential issues and mitigations
4. **File changes** - List of files to create/modify

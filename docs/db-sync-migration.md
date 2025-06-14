# Database Sync Migration

This document outlines the changes made to enable database sync by default across all stores in the Cryptrade application.

## Summary of Changes

### 1. Store Updates

All major stores have been updated to have `isDbEnabled: true` by default:

- **Analysis History Store** (`/store/analysis-history.store.ts`)
  - Set `isDbEnabled: true` in initial state
  - Updated migration to set `isDbEnabled: true` for existing data
  - Made `enableDbSync` and `disableDbSync` internal methods (prefixed with `_`)

- **Chat Store** (`/store/chat.store.ts`)
  - Set `isDbEnabled: true` in initial state
  - Updated migration to set `isDbEnabled: true` for existing data
  - Exported `useChatStoreBase` for internal use

- **Conversation Memory Store** (`/lib/store/conversation-memory.store.ts`)
  - Set `isDbEnabled: true` in initial state
  - Updated migration to set `isDbEnabled: true` for existing data

- **Enhanced Conversation Memory Store** (`/lib/store/enhanced-conversation-memory.store.ts`)
  - Set `isDbEnabled: true` in initial state
  - Updated migration to set `isDbEnabled: true` for existing data

### 2. Chart Persistence Updates

- Created **Chart Persistence Wrapper** (`/lib/storage/chart-persistence-wrapper.ts`)
  - Wraps the DB-enabled chart persistence manager
  - Automatically enables database on import
  - Provides backward-compatible API for Map<->Array conversion
  - Exports both `ChartPersistenceManager` and `chartPersistence` helper

- Updated chart stores to use the wrapper:
  - **Pattern Store** (`/store/chart/stores/pattern.store.ts`)
  - **Drawing Store** (`/store/chart/stores/drawing.store.ts`)
  - **Chart Base Store** (`/store/chart/stores/chart-base.store.ts`)

### 3. Initialization Infrastructure

- Created **DB Store Initializer** (`/lib/store/initialize-db-stores.ts`)
  - Provides `initializeDbStores()` function to load data from DB on startup
  - Provides `checkDbStatus()` to verify DB sync status
  - Provides `syncAllStores()` to force sync all stores

- Created **DB Store Provider** (`/components/providers/db-store-provider.tsx`)
  - React component that ensures DB initialization on mount
  - Should be added to the app's provider hierarchy

## Implementation Guide

### 1. Add the DB Store Provider to your app

```tsx
// In your root layout or _app.tsx
import { DbStoreProvider } from '@/components/providers/db-store-provider';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <DbStoreProvider>
          {/* Other providers */}
          {children}
        </DbStoreProvider>
      </body>
    </html>
  );
}
```

### 2. Use the new chart persistence wrapper

```tsx
// Instead of:
import { ChartPersistenceManager } from '@/lib/storage/chart-persistence';

// Use:
import { ChartPersistenceManager, chartPersistence } from '@/lib/storage/chart-persistence-wrapper';

// The API is backward compatible, but now uses DB by default
```

### 3. Check DB status programmatically

```tsx
import { checkDbStatus } from '@/lib/store/initialize-db-stores';

const status = checkDbStatus();
console.log('DB sync status:', status);
// {
//   analysisHistory: true,
//   chat: true,
//   conversationMemory: true,
//   enhancedMemory: true,
//   chartPersistence: true
// }
```

## What's NOT Using DB

The following components still use localStorage directly, which is intentional:

1. **View Persistence Hooks** (`use-view-persistence.ts`, `use-view-persistence-simple.ts`)
   - These store UI state (current view) which doesn't need DB sync

2. **Config Store** (`config.store.ts`)
   - Stores user preferences (theme, locale, etc.)
   - Uses a StorageEngine abstraction for flexibility
   - Could be extended to use DB in the future if needed

3. **Browser Notifications** (`browser-notifications.ts`)
   - Only stores a preference flag for auto-requesting permissions
   - This is browser-specific and doesn't need DB sync

## Migration Notes

- All stores will automatically migrate existing localStorage data to the database on first load
- The migration is non-destructive - localStorage data is preserved as a fallback
- If database operations fail, stores will continue to work with localStorage

## Testing

To verify everything is working:

1. Check the browser console for initialization logs:
   ```
   [DbStores] Initializing database-enabled stores...
   [DbStores] All stores initialized with database sync enabled
   ```

2. Check the Network tab for Supabase API calls when:
   - Creating new chat sessions
   - Adding analysis records
   - Saving chart drawings/patterns

3. Use the debug tools to verify DB status:
   ```tsx
   // In browser console
   window.__checkDbStatus = () => {
     const { checkDbStatus } = await import('@/lib/store/initialize-db-stores');
     return checkDbStatus();
   };
   ```
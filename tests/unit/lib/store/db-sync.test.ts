import { createDbSyncHandlers } from '@/lib/db-sync';

describe('db sync handlers', () => {
  it('disableDbSync toggles flag', () => {
    const state = { sessions: {}, isDbEnabled: true, isSyncing: false, currentSessionId: null } as any;
    const handlers = createDbSyncHandlers<(typeof state)>(fn => fn(state), () => state);
    handlers.disableDbSync();
    expect(state.isDbEnabled).toBe(false);
  });
});

import { createDbSyncHandlers } from '../db-sync';
import type { ConversationSession } from '@/types/conversation-memory';

describe('db sync handlers', () => {
  it('disableDbSync toggles flag', () => {
    const state = { sessions: {}, isDbEnabled: true, isSyncing: false, currentSessionId: null } as any;
    const handlers = createDbSyncHandlers<(typeof state)>(fn => fn(state), () => state);
    handlers.disableDbSync();
    expect(state.isDbEnabled).toBe(false);
  });
});

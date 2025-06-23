const { useEnhancedConversationMemory } = require('./lib/store/enhanced-conversation-memory.store');

console.log('Store:', useEnhancedConversationMemory);
console.log('typeof Store:', typeof useEnhancedConversationMemory);

if (useEnhancedConversationMemory && typeof useEnhancedConversationMemory.getState === 'function') {
  const state = useEnhancedConversationMemory.getState();
  console.log('State:', state);
  console.log('State keys:', Object.keys(state));
  console.log('createSession:', typeof state.createSession);
} else {
  console.log('Store.getState is not a function');
}
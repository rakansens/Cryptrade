/**
 * Debug test to verify Memory Store mock functionality
 */

describe('Memory Store Mock Verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should use mocked Memory Store correctly', async () => {
    // Import the mocked store
    const { useEnhancedConversationMemory } = await import('@/lib/store/enhanced-conversation-memory.store');
    
    const mockStore = useEnhancedConversationMemory.getState();
    
    console.log('Mock store object:', mockStore);
    console.log('getSessionContext method:', mockStore.getSessionContext);
    console.log('addMessage method:', mockStore.addMessage);
    
    // Test basic functionality
    expect(mockStore).toBeDefined();
    expect(mockStore.getSessionContext).toBeDefined();
    expect(mockStore.addMessage).toBeDefined();
    expect(mockStore.getProcessedMessages).toBeDefined();
    
    // Test method calls
    const context = mockStore.getSessionContext();
    console.log('Session context:', context);
    expect(context).toBe('Previous context');
    
    const messages = mockStore.getProcessedMessages();
    console.log('Processed messages:', messages);
    expect(Array.isArray(messages)).toBe(true);
    
    // Test addMessage
    await mockStore.addMessage({
      sessionId: 'test-session',
      role: 'user',
      content: 'Test message',
      agentId: 'test-agent',
      metadata: {}
    });
    
    expect(mockStore.addMessage).toHaveBeenCalledWith({
      sessionId: 'test-session',
      role: 'user',
      content: 'Test message',
      agentId: 'test-agent',
      metadata: {}
    });
  });

  it('should test Orchestrator with mocked Memory Store', async () => {
    // Import the orchestrator
    const { executeImprovedOrchestrator } = await import('@/lib/mastra/agents/orchestrator.agent');
    
    // Import the mocked store
    const { useEnhancedConversationMemory } = await import('@/lib/store/enhanced-conversation-memory.store');
    const mockStore = useEnhancedConversationMemory.getState();
    
    console.log('=== Before executeImprovedOrchestrator ===');
    console.log('Mock store methods:');
    console.log('- getSessionContext:', typeof mockStore.getSessionContext);
    console.log('- addMessage:', typeof mockStore.addMessage);
    console.log('- getProcessedMessages:', typeof mockStore.getProcessedMessages);
    
    try {
      const result = await executeImprovedOrchestrator('BTCの価格');
      console.log('=== Orchestrator execution result ===');
      console.log('Success:', result.success);
      console.log('Intent:', result.analysis?.intent);
      console.log('Reasoning:', result.analysis?.reasoning);
      
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
      
    } catch (error) {
      console.error('=== Orchestrator execution error ===');
      console.error('Error:', error);
      console.error('Stack:', error instanceof Error ? error.stack : 'No stack');
      throw error;
    }
  });
});
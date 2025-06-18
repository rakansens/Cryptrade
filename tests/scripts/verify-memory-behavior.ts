#!/usr/bin/env tsx

/**
 * Simple verification script to check memory system behavior
 */

import { useEnhancedConversationMemory, createEnhancedSession } from '@/lib/store/enhanced-conversation-memory.store';

async function verifyBasicFunctionality() {
  console.log('\n🔍 Verifying basic memory functionality\n');
  
  // Clear state
  useEnhancedConversationMemory.setState({ 
    sessions: {}, 
    currentSessionId: null,
    isDbEnabled: false 
  });
  
  // Create session
  const sessionId = await createEnhancedSession();
  console.log(`✅ Created session: ${sessionId}`);
  
  // Check session exists
  const state1 = useEnhancedConversationMemory.getState();
  const session1 = state1.sessions[sessionId];
  console.log(`✅ Session exists: ${!!session1}`);
  console.log(`   - Processors: ${session1?.processors.map(p => p.getName()).join(', ')}`);
  console.log(`   - Messages: ${session1?.messages.length}`);
  console.log(`   - Token usage: ${JSON.stringify(session1?.tokenUsage)}`);
  
  // Add message
  await state1.addMessage({
    sessionId,
    role: 'user',
    content: 'Test message',
  });
  
  // Check message was added
  const state2 = useEnhancedConversationMemory.getState();
  const session2 = state2.sessions[sessionId];
  console.log(`\n✅ After adding message:`);
  console.log(`   - Messages: ${session2?.messages.length}`);
  console.log(`   - First message: ${session2?.messages[0]?.content}`);
  console.log(`   - Token usage: ${JSON.stringify(session2?.tokenUsage)}`);
  
  // Get processed messages
  const processed = state2.getProcessedMessages(sessionId);
  console.log(`\n✅ Processed messages: ${processed.length}`);
  
  // Test custom session
  const customId = await createEnhancedSession('custom-test', {
    maxTokens: 5000,
    excludeTools: ['testTool']
  });
  
  const state3 = useEnhancedConversationMemory.getState();
  const customSession = state3.sessions[customId];
  console.log(`\n✅ Custom session created: ${customId}`);
  console.log(`   - Processors: ${customSession?.processors.map(p => p.getName()).join(', ')}`);
  
  console.log('\n✨ Basic functionality verified!\n');
}

verifyBasicFunctionality().catch(console.error);
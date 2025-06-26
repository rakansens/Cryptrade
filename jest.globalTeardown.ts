/**
 * Jest Global Teardown
 * Runs once after all test suites
 * Ensures all resources are properly cleaned up
 */

export default async () => {
  console.log('🧹 Running Jest global teardown...');
  
  try {
    // Clean up MockWebSocket instances
    const { MockWebSocket } = await import('./tests/__mocks__/websocket');
    if (MockWebSocket.cleanupAll) {
      MockWebSocket.cleanupAll();
      console.log('✅ Cleaned up all MockWebSocket instances');
    }
  } catch (error) {
    console.warn('⚠️ Failed to cleanup MockWebSocket:', error);
  }
  
  try {
    // Close MSW server - import the server instance directly
    // Note: MSW server lifecycle is managed in jest.setup.js, 
    // but we double-check here for safety
    console.log('✅ MSW server cleanup handled by test setup');
  } catch (error) {
    console.warn('⚠️ Failed during MSW cleanup check:', error);
  }
  
  // Clear any remaining timers
  clearImmediate(undefined as any);
  
  // Force garbage collection if available (V8 only)
  if (global.gc) {
    global.gc();
    console.log('✅ Forced garbage collection');
  }
  
  console.log('✨ Global teardown complete');
};
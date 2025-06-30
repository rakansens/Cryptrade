// MSW (Mock Service Worker) setup for tests
let setupServer: any;
let http: any;
let HttpResponse: any;
let handlers: any[] = [];

try {
  const msw = require('msw');
  const mswNode = require('msw/node');
  setupServer = mswNode.setupServer;
  http = msw.http;
  HttpResponse = msw.HttpResponse;
  
  // Import default handlers
  try {
    const { handlers: defaultHandlers } = require('../mocks/msw/handlers');
    handlers = defaultHandlers || [];
    console.log(`[MSW] Loaded ${handlers.length} default handlers`);
    
    // Log handler details for debugging
    if (handlers.length > 0) {
      console.log('[MSW] Handler summary:');
      handlers.forEach((handler: any, index: number) => {
        if (handler && typeof handler === 'object') {
          const method = handler.info?.method || 'UNKNOWN';
          const path = handler.info?.path || 'UNKNOWN_PATH';
          console.log(`  ${index + 1}. ${method} ${path}`);
        }
      });
    }
  } catch (e) {
    console.warn('[MSW] Could not load MSW handlers:', e);
    handlers = [];
  }
} catch (e) {
  // Fallback if MSW is not available
  setupServer = () => ({
    listen: () => {},
    resetHandlers: () => {},
    close: () => {},
    use: () => {},
  });
  http = {
    get: () => {},
    post: () => {},
    put: () => {},
    delete: () => {},
    patch: () => {},
  };
  HttpResponse = {
    json: () => {},
    text: () => {},
    error: () => {},
  };
}

// Create MSW server instance with default handlers
export const mswServer = setupServer(...handlers);

// Start server before all tests
beforeAll(() => {
  try {
    mswServer.listen({
      onUnhandledRequest: 'warn' // Use 'warn' to log unhandled requests without failing tests
    });
    console.log('[MSW] Server started successfully');
  } catch (error) {
    console.error('[MSW] Failed to start server:', error);
  }
});

// Reset handlers after each test to ensure test isolation
afterEach(() => {
  try {
    mswServer.resetHandlers();
  } catch (error) {
    console.warn('[MSW] Failed to reset handlers:', error);
  }
});

// Clean up after all tests with explicit closure
afterAll(() => {
  try {
    mswServer.close();
    console.log('[MSW] Server closed successfully');
  } catch (error) {
    console.warn('[MSW] Failed to close server:', error);
  }
});

// Export for test files to add custom handlers
export { http, HttpResponse };
// For backward compatibility
export const rest = http;
// Export server for global teardown
export const server = mswServer;
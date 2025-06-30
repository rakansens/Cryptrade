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
  
  // Import default handlers - try TypeScript first, then JavaScript
  try {
    const { handlers: defaultHandlers } = require('../mocks/msw/handlers.ts');
    handlers = defaultHandlers || [];
    console.log(`[MSW] Loaded ${handlers.length} default handlers from TypeScript`);
  } catch (e) {
    try {
      const { handlers: defaultHandlers } = require('../mocks/msw/handlers');
      handlers = defaultHandlers || [];
      console.log(`[MSW] Loaded ${handlers.length} default handlers from JavaScript`);
    } catch (e2) {
      console.warn('[MSW] Could not load MSW handlers from either TS or JS:', e2);
      handlers = [];
    }
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
    if (typeof mswServer.listen === 'function') {
      mswServer.listen({
        onUnhandledRequest: 'warn' // Use 'warn' to log unhandled requests without failing tests
      });
      console.log(`[MSW] Server started successfully with ${handlers.length} handlers`);
    } else {
      console.warn('[MSW] Server listen method not available - using fallback mode');
    }
  } catch (error) {
    console.error('[MSW] Failed to start server:', error);
    console.error('[MSW] Error details:', error.message);
  }
});

// Reset handlers after each test to ensure test isolation
afterEach(() => {
  try {
    // Reset to original handlers, not empty
    mswServer.resetHandlers(...handlers);
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
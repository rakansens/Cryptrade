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
    handlers = defaultHandlers;
    console.log(`[MSW] Loaded ${handlers.length} default handlers`);
    // Log handler count for debugging
    const localHandlers = handlers.filter((h: any) => h.info?.path?.includes('localhost:3000')).length;
    const externalHandlers = handlers.length - localHandlers;
    console.log(`[MSW] Local API handlers: ${localHandlers}, External API handlers: ${externalHandlers}`);
  } catch (e) {
    console.warn('Could not load MSW handlers:', e);
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
  mswServer.listen({ 
    onUnhandledRequest: 'warn' // Use 'warn' to log unhandled requests without failing tests
  });
  // console.log('✅ MSW server started');
});

// Reset handlers after each test to ensure test isolation
afterEach(() => {
  mswServer.resetHandlers();
});

// Clean up after all tests with explicit closure
afterAll(() => {
  mswServer.close();
  // console.log('✅ MSW server closed');
});

// Export for test files to add custom handlers
export { http, HttpResponse };
// For backward compatibility
export const rest = http;
// Export server for global teardown
export const server = mswServer;
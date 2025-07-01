// MSW (Mock Service Worker) setup for tests
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { handlers } from '../mocks/msw/handlers';

console.log(`[MSW Debug] Loading ${handlers.length} handlers`);

// Create MSW server instance with handlers
export const mswServer = setupServer(...handlers);

// Start server before all tests
beforeAll(() => {
  console.log('[MSW Debug] Starting server in beforeAll...');
  mswServer.listen({
    onUnhandledRequest: (req) => {
      console.warn(`[MSW Debug] Unhandled ${req.method} request to ${req.url}`);
    }
  });
  console.log(`[MSW Debug] Server started successfully with ${handlers.length} handlers`);
});

// Reset handlers after each test
afterEach(() => {
  mswServer.resetHandlers();
});

// Clean up after all tests
afterAll(() => {
  mswServer.close();
  console.log('[MSW Debug] Server closed successfully');
});

// Export for test files
export { http, HttpResponse };
export const rest = http; // For backward compatibility
export const server = mswServer;
// Test Environment Setup - Environment variables and configuration

// Set environment variables with proper type handling
if (!process.env.NODE_ENV) {
  (process.env as any).NODE_ENV = 'test';
}
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost:3000';

// Test timeout configuration
jest.setTimeout(10000);

// Log environment setup
console.log('[Test Env] Environment variables configured for test mode');
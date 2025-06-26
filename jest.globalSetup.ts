/**
 * Jest Global Setup
 * Runs once before all test suites
 */

export default async () => {
  // Set up test environment
  if (process.env.NODE_ENV !== 'test') {
    (process.env as any).NODE_ENV = 'test';
  }
  
  // Initialize any global resources if needed
  console.log('🔧 Running Jest global setup...');
  
  // Future: Add database initialization, test data seeding, etc.
};
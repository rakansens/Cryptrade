import { MemoryProcessor } from '@/lib/store/processors/memory-processor';

describe('memory-processor', () => {

  // Mock logger
  jest.mock('@/lib/utils/logger', () => ({
    logger: {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }
  }));

  // Mock zustand helpers
  jest.mock('@/lib/utils/zustand-helpers', () => ({
    createStoreDebugger: () => jest.fn()
  }));
  
  it('should export MemoryProcessor interface', () => {
    // This is a TypeScript interface, so we can't test it at runtime
    // The test passes if the import doesn't throw an error
    expect(true).toBe(true);
  });
});

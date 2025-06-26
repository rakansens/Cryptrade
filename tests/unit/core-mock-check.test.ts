import { createTool } from '@mastra/core';

describe('core mock basic', () => {
  it('createTool should be function', () => {
    expect(typeof createTool).toBe('function');
  });
}); 
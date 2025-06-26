import { describe, it, expect, jest } from '@jest/globals';
import { createTool } from '@mastra/core';

describe('mastra core mock', () => {
  it('createTool should be function', () => {
    expect(typeof createTool).toBe('function');
  });
}); 
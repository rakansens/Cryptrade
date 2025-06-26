import { describe, it, expect } from '@jest/globals';
import { createTool } from '@mastra/core';

describe('Mastra Core Mock', () => {
  it('createTool is function', () => {
    expect(typeof createTool).toBe('function');
  });
}); 
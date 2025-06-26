// ---------------------------------------------------------------------------
// Enhanced manual mock for @mastra/core
// - Implements a lightweight `Tool` class so that `new Tool({...})` works
// - `createTool` factory returns an instance of `Tool`
// - Keeps original execute implementation so tests exercise real logic

class Tool {
  constructor(config = {}) {
    // Copy all provided config onto the instance so props are accessible
    Object.assign(this, config);

    // Preserve execute function if provided; otherwise stub
    if (typeof config.execute === 'function') {
      // Bind to this for convenience
      this.execute = config.execute.bind(this);
    } else {
      // Provide a jest.fn fallback to avoid undefined errors
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore – jest is globally available in test env
      this.execute = jest.fn();
    }
  }
}

// Factory that mirrors real Mastra API but simply instantiates Tool
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore – jest is globally available in test env
const createTool = jest.fn((config) => new Tool(config));

module.exports = {
  __esModule: true,
  // Mocked primitives -------------------------------------------------------
  Tool,
  createTool,
  createWorkflow: jest.fn((config) => ({
    ...config,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    execute: jest.fn(),
  })),

  // Agent / Mastra wrappers --------------------------------------------------
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  Agent: jest.fn().mockImplementation(() => ({
    runThread: jest.fn(),
    runWorkflow: jest.fn(),
  })),
  Mastra: jest.fn().mockImplementation(() => ({
    getAgent: jest.fn(),
    getWorkflow: jest.fn(),
    getTool: jest.fn(),
  })),

  // Default export for ESM compatibility -------------------------------------
  default: { createTool, Tool },
};
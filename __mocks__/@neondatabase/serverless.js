// __mocks__/@neondatabase/serverless.js
// Mock for @neondatabase/serverless

const mockQuery = jest.fn().mockResolvedValue({ rows: [] });

const neon = jest.fn(() => mockQuery);

module.exports = {
  neon,
  mockQuery, // Export for test assertions
};
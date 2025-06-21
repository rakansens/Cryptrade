// Mock for nanoid/non-secure
export const nanoid = jest.fn(() => 'mock-id-' + Math.random().toString(36).substr(2, 9));
export const customAlphabet = jest.fn((alphabet, size) => {
  return jest.fn(() => 'mock-custom-' + Math.random().toString(36).substr(2, size || 9));
});
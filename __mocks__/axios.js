// __mocks__/axios.js
// Jest global mock for axios to avoid installing the real package

const mockAxios = jest.fn(() => Promise.resolve({ data: {} }));

mockAxios.create = () => mockAxios;
mockAxios.get = jest.fn(() => Promise.resolve({ data: {} }));
mockAxios.post = jest.fn(() => Promise.resolve({ data: {} }));
mockAxios.put = jest.fn(() => Promise.resolve({ data: {} }));
mockAxios.delete = jest.fn(() => Promise.resolve({ data: {} }));

module.exports = mockAxios; 
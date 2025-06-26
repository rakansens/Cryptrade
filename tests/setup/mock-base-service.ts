import { jest } from '@jest/globals';

export function createMockBaseServiceClass() {
  return class MockBaseService {
    protected headers: Record<string, string> = {};
    
    constructor(protected basePath: string) {}
    
    protected async get = jest.fn();
    protected async post = jest.fn();
    protected async put = jest.fn();
    protected async delete = jest.fn();
    
    protected buildURL(path: string, params?: Record<string, string>): string {
      const url = new URL(path, this.basePath);
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          url.searchParams.append(key, value);
        });
      }
      return url.toString();
    }
  };
}
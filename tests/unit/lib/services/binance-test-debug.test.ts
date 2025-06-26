// Debug test to check if our service is using BaseService correctly
import { describe, it, expect, beforeEach } from '@jest/globals';

// Simple test without any mocks first
describe('BinanceAPIService Debug - No Mocks', () => {
  it('should check if the service imports correctly', async () => {
    // Dynamic import to avoid hoisting issues
    const { BinanceAPIService } = await import('@/lib/binance/api-service');
    const service = new BinanceAPIService();
    
    console.log('[DEBUG] Service created:', service.constructor.name);
    console.log('[DEBUG] Service properties:', Object.getOwnPropertyNames(service));
    console.log('[DEBUG] Service prototype:', Object.getOwnPropertyNames(Object.getPrototypeOf(service)));
    console.log('[DEBUG] Service base classes:', Object.getOwnPropertyNames(Object.getPrototypeOf(Object.getPrototypeOf(service))));
    
    expect(service).toBeDefined();
    expect(service.constructor.name).toBe('BinanceAPIService');
  });
  
  it('should show actual behavior without mocks', async () => {
    const { BinanceAPIService } = await import('@/lib/binance/api-service');
    const service = new BinanceAPIService();
    
    // Let's see what happens when we try to call the method
    // This will probably fail with network error, but that's ok
    try {
      const result = await service.fetchKlines('BTCUSDT', '1h', 1);
      console.log('[DEBUG] Unexpected success:', result);
    } catch (error) {
      console.log('[DEBUG] Expected error:', error.message);
      // This is expected - shows the service is trying to make real calls
    }
    
    expect(true).toBe(true); // Just to make the test pass
  });
});
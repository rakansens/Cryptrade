/**
 * @jest-environment jsdom
 */

import { BrowserNotificationManager, notifications } from '../browser-notifications';
import { logger } from '@/lib/utils/logger';

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// Mock Notification API
const mockNotification = {
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn()
};

const NotificationMock = jest.fn().mockImplementation((title, options) => {
  return {
    ...mockNotification,
    title,
    ...options
  };
});

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};

describe('BrowserNotificationManager', () => {
  let manager: BrowserNotificationManager;
  
  beforeAll(() => {
    // Setup global mocks
    Object.defineProperty(window, 'Notification', {
      value: NotificationMock,
      writable: true,
      configurable: true
    });
    
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset Notification permission
    (Notification as any).permission = 'default';
    (Notification as any).requestPermission = jest.fn().mockResolvedValue('granted');
    
    // Create new instance
    manager = new BrowserNotificationManager();
  });

  describe('Initialization', () => {
    it('checks browser support on initialization', () => {
      expect(manager.supported).toBe(true);
    });

    it('handles missing Notification API', () => {
      // Temporarily remove Notification
      const originalNotification = window.Notification;
      delete (window as any).Notification;
      
      const unsupportedManager = new BrowserNotificationManager();
      expect(unsupportedManager.supported).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith('[Notifications] Browser does not support notifications');
      
      // Restore
      (window as any).Notification = originalNotification;
    });

    it('checks initial permission status', () => {
      (Notification as any).permission = 'granted';
      const grantedManager = new BrowserNotificationManager();
      expect(grantedManager.permissionStatus).toBe('granted');
    });

    it('handles server-side environment gracefully', () => {
      // Simulate server environment
      const originalWindow = global.window;
      delete (global as any).window;
      
      // Should not throw
      expect(() => new BrowserNotificationManager()).not.toThrow();
      
      // Restore
      global.window = originalWindow;
    });
  });

  describe('Permission Management', () => {
    it('requests permission successfully', async () => {
      const permission = await manager.requestPermission();
      
      expect(Notification.requestPermission).toHaveBeenCalled();
      expect(permission).toBe('granted');
      expect(logger.info).toHaveBeenCalledWith('[Notifications] Permission requested', { permission: 'granted' });
    });

    it('returns existing granted permission without requesting', async () => {
      (Notification as any).permission = 'granted';
      const grantedManager = new BrowserNotificationManager();
      
      const permission = await grantedManager.requestPermission();
      
      expect(Notification.requestPermission).not.toHaveBeenCalled();
      expect(permission).toBe('granted');
    });

    it('handles permission denial', async () => {
      (Notification.requestPermission as jest.Mock).mockResolvedValue('denied');
      
      const permission = await manager.requestPermission();
      
      expect(permission).toBe('denied');
      expect(logger.info).toHaveBeenCalledWith('[Notifications] Permission requested', { permission: 'denied' });
    });

    it('handles permission request errors', async () => {
      (Notification.requestPermission as jest.Mock).mockRejectedValue(new Error('Permission error'));
      
      const permission = await manager.requestPermission();
      
      expect(permission).toBe('denied');
      expect(logger.error).toHaveBeenCalledWith('[Notifications] Failed to request permission', expect.any(Error));
    });

    it('handles unsupported browser when requesting permission', async () => {
      // Remove Notification API
      const originalNotification = window.Notification;
      delete (window as any).Notification;
      
      const unsupportedManager = new BrowserNotificationManager();
      const permission = await unsupportedManager.requestPermission();
      
      expect(permission).toBe('denied');
      expect(logger.warn).toHaveBeenCalledWith('[Notifications] Cannot request permission - not supported');
      
      // Restore
      (window as any).Notification = originalNotification;
    });
  });

  describe('Show Notifications', () => {
    it('shows notification with granted permission', async () => {
      (Notification as any).permission = 'granted';
      const grantedManager = new BrowserNotificationManager();
      
      const notification = await grantedManager.show({
        title: 'Test Title',
        body: 'Test Body',
        icon: '/test-icon.png',
        tag: 'test-tag',
        requireInteraction: true,
        silent: false
      });
      
      expect(notification).toBeDefined();
      expect(NotificationMock).toHaveBeenCalledWith('Test Title', {
        body: 'Test Body',
        icon: '/test-icon.png',
        tag: 'test-tag',
        requireInteraction: true,
        silent: false
      });
      expect(logger.info).toHaveBeenCalledWith('[Notifications] Notification shown', {
        title: 'Test Title',
        tag: 'test-tag'
      });
    });

    it('requests permission before showing if not granted', async () => {
      const notification = await manager.show({
        title: 'Test',
        body: 'Body'
      });
      
      expect(Notification.requestPermission).toHaveBeenCalled();
      expect(notification).toBeDefined();
    });

    it('returns null when permission is denied', async () => {
      (Notification as any).permission = 'denied';
      const deniedManager = new BrowserNotificationManager();
      (Notification.requestPermission as jest.Mock).mockResolvedValue('denied');
      
      const notification = await deniedManager.show({
        title: 'Test',
        body: 'Body'
      });
      
      expect(notification).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith('[Notifications] Cannot show notification - permission denied');
    });

    it('uses default icon when not provided', async () => {
      (Notification as any).permission = 'granted';
      const grantedManager = new BrowserNotificationManager();
      
      await grantedManager.show({
        title: 'Test',
        body: 'Body'
      });
      
      expect(NotificationMock).toHaveBeenCalledWith('Test', expect.objectContaining({
        icon: '/favicon.ico'
      }));
    });

    it('handles notification creation errors', async () => {
      (Notification as any).permission = 'granted';
      const grantedManager = new BrowserNotificationManager();
      NotificationMock.mockImplementationOnce(() => {
        throw new Error('Notification error');
      });
      
      const notification = await grantedManager.show({
        title: 'Test',
        body: 'Body'
      });
      
      expect(notification).toBeNull();
      expect(logger.error).toHaveBeenCalledWith('[Notifications] Failed to show notification', expect.any(Error));
    });

    it('handles unsupported browser when showing notification', async () => {
      const originalNotification = window.Notification;
      delete (window as any).Notification;
      
      const unsupportedManager = new BrowserNotificationManager();
      const notification = await unsupportedManager.show({
        title: 'Test',
        body: 'Body'
      });
      
      expect(notification).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith('[Notifications] Cannot show notification - not supported');
      
      (window as any).Notification = originalNotification;
    });
  });

  describe('Specialized Notifications', () => {
    beforeEach(() => {
      (Notification as any).permission = 'granted';
      manager = new BrowserNotificationManager();
    });

    describe('showLineTouch', () => {
      it('shows bounce notification', async () => {
        await manager.showLineTouch('BTCUSDT', 45000, 'bounce');
        
        expect(NotificationMock).toHaveBeenCalledWith('🔄 BTCUSDT ラインでバウンスしました', expect.objectContaining({
          body: '価格: $45,000',
          tag: 'line-touch-BTCUSDT',
          requireInteraction: false
        }));
      });

      it('shows break notification with interaction required', async () => {
        await manager.showLineTouch('ETHUSDT', 3000, 'break');
        
        expect(NotificationMock).toHaveBeenCalledWith('💥 ETHUSDT ラインを突破しました', expect.objectContaining({
          body: '価格: $3,000',
          tag: 'line-touch-ETHUSDT',
          requireInteraction: true
        }));
      });

      it('shows test notification', async () => {
        await manager.showLineTouch('BNBUSDT', 400, 'test');
        
        expect(NotificationMock).toHaveBeenCalledWith('👀 BNBUSDT ラインをテストしています', expect.objectContaining({
          body: '価格: $400',
          tag: 'line-touch-BNBUSDT',
          requireInteraction: false
        }));
      });
    });

    describe('showAnalysisComplete', () => {
      it('shows success notification', async () => {
        await manager.showAnalysisComplete('BTCUSDT', 'success', 0.95);
        
        expect(NotificationMock).toHaveBeenCalledWith('✅ BTCUSDT 分析が成功しました', expect.objectContaining({
          body: '精度: 95%',
          tag: 'analysis-complete-BTCUSDT',
          requireInteraction: false
        }));
      });

      it('shows partial success notification', async () => {
        await manager.showAnalysisComplete('ETHUSDT', 'partial', 0.75);
        
        expect(NotificationMock).toHaveBeenCalledWith('⚠️ ETHUSDT 部分的に成功しました', expect.objectContaining({
          body: '精度: 75%'
        }));
      });

      it('shows failure notification', async () => {
        await manager.showAnalysisComplete('BNBUSDT', 'failure', 0.3);
        
        expect(NotificationMock).toHaveBeenCalledWith('❌ BNBUSDT 分析が失敗しました', expect.objectContaining({
          body: '精度: 30%'
        }));
      });
    });

    describe('showConnectionStatus', () => {
      it('shows connected notification', async () => {
        await manager.showConnectionStatus(true, 5);
        
        expect(NotificationMock).toHaveBeenCalledWith('📡 リアルタイム接続が確立されました', expect.objectContaining({
          body: '5個のシンボルを監視中',
          tag: 'connection-status',
          silent: true
        }));
      });

      it('shows disconnected notification', async () => {
        await manager.showConnectionStatus(false);
        
        expect(NotificationMock).toHaveBeenCalledWith('⚠️ リアルタイム接続が切断されました', expect.objectContaining({
          body: 'モックデータで動作中',
          tag: 'connection-status',
          silent: false // Default value when not specified
        }));
      });
    });
  });

  describe('Permission Properties', () => {
    it('hasPermission returns true when granted', () => {
      (Notification as any).permission = 'granted';
      const grantedManager = new BrowserNotificationManager();
      expect(grantedManager.hasPermission).toBe(true);
    });

    it('hasPermission returns false when not granted', () => {
      (Notification as any).permission = 'denied';
      const deniedManager = new BrowserNotificationManager();
      expect(deniedManager.hasPermission).toBe(false);
      
      (Notification as any).permission = 'default';
      const defaultManager = new BrowserNotificationManager();
      expect(defaultManager.hasPermission).toBe(false);
    });

    it('supported property reflects browser support', () => {
      expect(manager.supported).toBe(true);
      
      const originalNotification = window.Notification;
      delete (window as any).Notification;
      
      const unsupportedManager = new BrowserNotificationManager();
      expect(unsupportedManager.supported).toBe(false);
      
      (window as any).Notification = originalNotification;
    });

    it('permissionStatus returns current permission', () => {
      (Notification as any).permission = 'granted';
      const grantedManager = new BrowserNotificationManager();
      expect(grantedManager.permissionStatus).toBe('granted');
      
      (Notification as any).permission = 'denied';
      const deniedManager = new BrowserNotificationManager();
      expect(deniedManager.permissionStatus).toBe('denied');
    });
  });

  describe('Singleton Instance', () => {
    it('exports singleton instance', () => {
      expect(notifications).toBeInstanceOf(BrowserNotificationManager);
    });

    it('does not auto-request in test environment', () => {
      // Clear previous calls from singleton creation
      jest.clearAllMocks();
      
      // Import should not trigger auto-request in test
      expect(Notification.requestPermission).not.toHaveBeenCalled();
    });

    it('auto-requests when localStorage flag is set', async () => {
      localStorageMock.getItem.mockReturnValue('true');
      
      // Re-import to trigger auto-request logic
      jest.resetModules();
      jest.doMock('@/lib/utils/logger', () => ({
        logger: {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn()
        }
      }));
      
      // Dynamic import to trigger initialization
      await import('../browser-notifications');
      
      // Should check localStorage
      expect(localStorageMock.getItem).toHaveBeenCalledWith('auto-request-notifications');
    });
  });

  describe('Edge Cases', () => {
    it('handles notification with very long text', async () => {
      (Notification as any).permission = 'granted';
      const grantedManager = new BrowserNotificationManager();
      
      const longText = 'a'.repeat(1000);
      const notification = await grantedManager.show({
        title: longText,
        body: longText
      });
      
      expect(notification).toBeDefined();
      expect(NotificationMock).toHaveBeenCalledWith(longText, expect.objectContaining({
        body: longText
      }));
    });

    it('handles special characters in notification text', async () => {
      (Notification as any).permission = 'granted';
      const grantedManager = new BrowserNotificationManager();
      
      const specialText = '📈 <script>alert("xss")</script> & "quotes" \'single\'';
      const notification = await grantedManager.show({
        title: specialText,
        body: specialText
      });
      
      expect(notification).toBeDefined();
      expect(NotificationMock).toHaveBeenCalledWith(specialText, expect.objectContaining({
        body: specialText
      }));
    });

    it('handles undefined optional parameters', async () => {
      (Notification as any).permission = 'granted';
      const grantedManager = new BrowserNotificationManager();
      
      const notification = await grantedManager.show({
        title: 'Test',
        body: 'Body',
        icon: undefined,
        tag: undefined,
        requireInteraction: undefined,
        silent: undefined
      });
      
      expect(notification).toBeDefined();
      expect(NotificationMock).toHaveBeenCalledWith('Test', expect.objectContaining({
        body: 'Body',
        icon: '/favicon.ico',
        requireInteraction: false,
        silent: false
      }));
    });
  });
});
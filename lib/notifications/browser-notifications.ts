// Browser notification system for line touch alerts

import { logger } from '@/lib/utils/logger';

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  requireInteraction?: boolean;
  silent?: boolean;
}

export class BrowserNotificationManager {
  private permission: NotificationPermission = 'default';
  private isSupported = false;

  constructor() {
    // Only initialize in browser environment
    if (typeof window !== 'undefined') {
      this.checkSupport();
      this.checkPermission();
    }
  }

  /**
   * Check if browser supports notifications
   */
  private checkSupport(): void {
    if (typeof window === 'undefined') return;
    
    this.isSupported = 'Notification' in window;
    if (!this.isSupported) {
      logger.warn('[Notifications] Browser does not support notifications');
    }
  }

  /**
   * Check current notification permission
   */
  private checkPermission(): void {
    if (typeof window === 'undefined') return;
    
    if (this.isSupported && 'Notification' in window) {
      this.permission = Notification.permission;
    }
  }

  /**
   * Request permission for notifications
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported) {
      logger.warn('[Notifications] Cannot request permission - not supported');
      return 'denied';
    }

    if (this.permission === 'granted') {
      return 'granted';
    }

    try {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      
      logger.info('[Notifications] Permission requested', { permission });
      return permission;
    } catch (error) {
      logger.error('[Notifications] Failed to request permission', error);
      return 'denied';
    }
  }

  /**
   * Show a notification
   */
  async show(options: NotificationOptions): Promise<Notification | null> {
    if (!this.isSupported) {
      logger.warn('[Notifications] Cannot show notification - not supported');
      return null;
    }

    // Request permission if needed
    if (this.permission !== 'granted') {
      const permission = await this.requestPermission();
      if (permission !== 'granted') {
        logger.warn('[Notifications] Cannot show notification - permission denied');
        return null;
      }
    }

    try {
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon || '/favicon.ico',
        tag: options.tag,
        requireInteraction: options.requireInteraction || false,
        silent: options.silent || false
      });

      logger.info('[Notifications] Notification shown', { 
        title: options.title, 
        tag: options.tag 
      });

      return notification;
    } catch (error) {
      logger.error('[Notifications] Failed to show notification', error);
      return null;
    }
  }

  /**
   * Show line touch notification
   */
  async showLineTouch(symbol: string, price: number, type: 'bounce' | 'break' | 'test'): Promise<void> {
    const emojis = {
      bounce: '🔄',
      break: '💥', 
      test: '👀'
    };

    const messages = {
      bounce: 'ラインでバウンスしました',
      break: 'ラインを突破しました',
      test: 'ラインをテストしています'
    };

    await this.show({
      title: `${emojis[type]} ${symbol} ${messages[type]}`,
      body: `価格: $${price.toLocaleString()}`,
      tag: `line-touch-${symbol}`,
      requireInteraction: type === 'break', // Require interaction for breaks
      icon: '/favicon.ico'
    });
  }

  /**
   * Show analysis completion notification
   */
  async showAnalysisComplete(symbol: string, result: 'success' | 'partial' | 'failure', accuracy: number): Promise<void> {
    const emojis = {
      success: '✅',
      partial: '⚠️',
      failure: '❌'
    };

    const messages = {
      success: '分析が成功しました',
      partial: '部分的に成功しました', 
      failure: '分析が失敗しました'
    };

    await this.show({
      title: `${emojis[result]} ${symbol} ${messages[result]}`,
      body: `精度: ${Math.round(accuracy * 100)}%`,
      tag: `analysis-complete-${symbol}`,
      requireInteraction: false
    });
  }

  /**
   * Show connection status notification
   */
  async showConnectionStatus(connected: boolean, symbolCount: number = 0): Promise<void> {
    if (connected) {
      await this.show({
        title: '📡 リアルタイム接続が確立されました',
        body: `${symbolCount}個のシンボルを監視中`,
        tag: 'connection-status',
        silent: true
      });
    } else {
      await this.show({
        title: '⚠️ リアルタイム接続が切断されました',
        body: 'モックデータで動作中',
        tag: 'connection-status'
      });
    }
  }

  /**
   * Check if permissions are granted
   */
  get hasPermission(): boolean {
    return this.permission === 'granted';
  }

  /**
   * Check if notifications are supported
   */
  get supported(): boolean {
    return this.isSupported;
  }

  /**
   * Get current permission status
   */
  get permissionStatus(): NotificationPermission {
    return this.permission;
  }
}

// Singleton instance
export const notifications = new BrowserNotificationManager();

// Auto-request permission on first import (optional)
if (typeof window !== 'undefined') {
  // Only auto-request in production or when explicitly enabled
  const autoRequest = process.env.NODE_ENV === 'production' || 
                     localStorage.getItem('auto-request-notifications') === 'true';
  
  if (autoRequest) {
    notifications.requestPermission().catch(() => {
      // Silently fail if permission is denied
    });
  }
}